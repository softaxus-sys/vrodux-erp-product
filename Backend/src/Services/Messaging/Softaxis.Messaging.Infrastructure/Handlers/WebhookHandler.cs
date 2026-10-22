using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.LeadIntake.Commands;
using Softaxis.Messaging.Application.Abstractions;
using Softaxis.Messaging.Application.WhatsApp;
using Softaxis.Messaging.Domain.Entities;
using Softaxis.Messaging.Infrastructure.Persistence;

namespace Softaxis.Messaging.Infrastructure.Handlers;

/// <summary>
/// Handles one webhook delivery from Meta. One app-wide URL serves every workspace; each change
/// names the receiving number, which is how its workspace is found. Each change is verified against
/// the app secret of the workspace that owns that number (Meta signs with the secret of the app that
/// sent it; a workspace on its own Meta app saves that app's secret in Setup), else the shared Vrodux
/// secret. Never throws — Meta retries anything that is not a 200, and a retry of a half-processed
/// body would duplicate work.
/// </summary>
internal sealed class ProcessWaWebhookHandler(
    MessagingDbContext db,
    IWhatsAppClient client,
    IMessagingSecretProtector secrets,
    IWhatsAppSender sender,
    ISender mediator,
    INotificationDispatcher notifications,
    INotificationRecipients recipients,
    IConfiguration config,
    ILogger<ProcessWaWebhookHandler> log) : ICommandHandler<ProcessWaWebhookCommand>
{
    private static readonly string[] StopWords = ["stop", "unsubscribe", "stop all", "إيقاف", "الغاء"];

    private enum Outcome { Unknown, Rejected, Processed }

    public async Task<Result> Handle(ProcessWaWebhookCommand cmd, CancellationToken ct)
    {
        // Nothing is even parsed into a workspace without a signature to check.
        if (string.IsNullOrEmpty(cmd.Signature) || !cmd.Signature.StartsWith("sha256=", StringComparison.Ordinal))
            return Unauthorized();

        JsonNode? root;
        try { root = JsonNode.Parse(cmd.RawBody); }
        catch (JsonException) { return Result.Success(); }

        int processed = 0, rejected = 0;
        foreach (var entry in root?["entry"]?.AsArray() ?? [])
        foreach (var change in entry?["changes"]?.AsArray() ?? [])
        {
            if (change?["field"]?.GetValue<string>() != "messages" || change["value"] is not JsonObject value) continue;
            try
            {
                var outcome = await ProcessValueAsync(value, cmd, ct);
                if (outcome == Outcome.Processed) processed++;
                else if (outcome == Outcome.Rejected) rejected++;
            }
            catch (Exception ex) { log.LogError(ex, "WhatsApp webhook change failed"); }
            finally { TenantAmbient.Clear(); db.ChangeTracker.Clear(); }
        }
        // Fail only when known numbers arrived and none verified, so a wrong secret shows as an
        // error in Meta's dashboard rather than silently dropping every reply.
        return rejected > 0 && processed == 0 ? Unauthorized() : Result.Success();
    }

    private static Result Unauthorized() => Result.Failure(Error.Custom("WhatsApp.Webhook.Unauthorized",
        "The webhook signature does not match this workspace's Meta app secret."));

    /// <summary>
    /// The secret that must have signed a delivery for this connection: the workspace's own app secret
    /// when it saved one, else the shared Vrodux app secret. Null = nothing to check against (refuse).
    /// A workspace secret that can no longer be decrypted never falls back to the shared one.
    /// </summary>
    private string? SecretFor(WaConnection conn)
    {
        if (!string.IsNullOrEmpty(conn.AppSecretCipher)) return secrets.Unprotect(conn.AppSecretCipher);
        var shared = config["Messaging:WhatsApp:AppSecret"];
        return string.IsNullOrWhiteSpace(shared) ? null : shared;
    }

    internal static bool SignatureMatches(string secret, byte[] body, string signatureHeader)
    {
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), body);
        byte[] given;
        try { given = Convert.FromHexString(signatureHeader["sha256=".Length..].Trim()); }
        catch (FormatException) { return false; }
        return CryptographicOperations.FixedTimeEquals(expected, given);
    }

    private async Task<Outcome> ProcessValueAsync(JsonObject value, ProcessWaWebhookCommand cmd, CancellationToken ct)
    {
        var phoneNumberId = value["metadata"]?["phone_number_id"]?.GetValue<string>();
        if (phoneNumberId is null) return Outcome.Unknown;

        var conn = await db.Connections.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.PhoneNumberId == phoneNumberId, ct);
        if (conn is null) return Outcome.Unknown;   // a number no workspace has connected (or one since disconnected)
        var tenantId = db.Entry(conn).Property<Guid?>("TenantId").CurrentValue;
        if (tenantId is null) return Outcome.Unknown;

        // Checked against the secret of the workspace this change would be written into, so one
        // workspace's secret can never be used to write into another workspace.
        var secret = SecretFor(conn);
        if (secret is null || !SignatureMatches(secret, cmd.RawBody, cmd.Signature!))
        {
            log.LogWarning("WhatsApp webhook for number {PhoneNumberId} rejected: signature does not match {Which} app secret",
                phoneNumberId, string.IsNullOrEmpty(conn.AppSecretCipher) ? "the shared" : "the workspace's own");
            return Outcome.Rejected;
        }

        // Everything below runs as that workspace: reads are filtered to it and writes stamped with it.
        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);

        foreach (var s in value["statuses"]?.AsArray() ?? [])
        {
            var id = s?["id"]?.GetValue<string>();
            var status = s?["status"]?.GetValue<string>();
            if (id is null || status is null) continue;
            var msg = await db.Messages.FirstOrDefaultAsync(m => m.WaMessageId == id, ct);
            var error = s?["errors"]?[0]?["title"]?.GetValue<string>() ?? s?["errors"]?[0]?["message"]?.GetValue<string>();
            msg?.ApplyStatus(status, error);
        }
        await db.SaveChangesAsync(ct);

        var profileName = value["contacts"]?[0]?["profile"]?["name"]?.GetValue<string>();
        foreach (var m in value["messages"]?.AsArray() ?? [])
            if (m is JsonObject jm) await ProcessInboundAsync(conn, tenantId.Value, jm, profileName, ct);
        return Outcome.Processed;
    }

    private async Task ProcessInboundAsync(WaConnection conn, Guid tenantId, JsonObject m, string? profileName, CancellationToken ct)
    {
        var waId = m["id"]?.GetValue<string>();
        var from = WaPhone.Normalize(m["from"]?.GetValue<string>());
        if (waId is null || from is null) return;
        if (await db.Messages.AnyAsync(x => x.WaMessageId == waId, ct)) return;   // Meta redelivery

        var type = m["type"]?.GetValue<string>() ?? "other";
        var text = type switch
        {
            "text"        => m["text"]?["body"]?.GetValue<string>(),
            "button"      => m["button"]?["text"]?.GetValue<string>(),
            "interactive" => m["interactive"]?["button_reply"]?["title"]?.GetValue<string>()
                             ?? m["interactive"]?["list_reply"]?["title"]?.GetValue<string>(),
            "image" or "video" or "document" or "audio" =>
                m[type]?["caption"]?.GetValue<string>() is { } cap ? $"[{type}] {cap}" : $"[{type}]",
            "location"    => "[location]",
            _             => $"[{type}]",
        } ?? $"[{type}]";

        var at = long.TryParse(m["timestamp"]?.GetValue<string>(), out var ts)
            ? DateTimeOffset.FromUnixTimeSeconds(ts).UtcDateTime : DateTime.UtcNow;

        var conv = await db.Conversations.FirstOrDefaultAsync(c => c.ContactPhone == from, ct);
        var isNew = conv is null;
        if (conv is null) { conv = new WaConversation(from, profileName); db.Conversations.Add(conv); }
        conv.SetName(profileName);

        var msg = new WaMessage(conv.Id, "in", type is "text" or "button" or "interactive" ? "text" : type, text);
        msg.MarkReceived(waId);
        msg.Describe(WaOrigin.Inbound, null, null, null, conv.RelatedType, conv.RelatedId);
        db.Messages.Add(msg);
        conv.RecordInbound(text, at);

        var stop = StopWords.Contains(text.Trim().ToLowerInvariant());
        if (stop) conv.OptOut();
        else if (conv.OptedOut) conv.OptIn();   // writing again is consent to a reply
        await db.SaveChangesAsync(ct);

        var token = secrets.Unprotect(conn.AccessTokenCipher);
        if (token is not null) await client.MarkReadAsync(conn.PhoneNumberId, token, waId, ct);

        if (conv.RelatedType is null && conn.CreateLeads && !stop)
            await CreateLeadAsync(conv, tenantId, text, ct);

        if (!stop) await AutoReplyAsync(conn, conv, text, isNew, ct);

        if (conv.UnreadCount == 1) await NotifyAsync(tenantId, conv, text, ct);
    }

    private async Task CreateLeadAsync(WaConversation conv, Guid tenantId, string text, CancellationToken ct)
    {
        try
        {
            // Only when the workspace actually has CRM; otherwise the lead would land in a module it cannot open.
            var modules = await db.Database
                .SqlQuery<string?>($"SELECT EnabledModules AS [Value] FROM [identity].[tenants] WHERE Id = {tenantId}")
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(modules) && !modules.Contains("crm", StringComparison.OrdinalIgnoreCase)) return;

            var name = conv.ContactName ?? $"+{conv.ContactPhone}";
            var res = await mediator.Send(new IngestLeadCommand(new IngestLeadInput(
                null, null, name, null, $"+{conv.ContactPhone}", null, null, null, null, null, null,
                "Wrote in on WhatsApp.", "whatsapp", null, null,
                WhatsApp: $"+{conv.ContactPhone}", Message: text.Length > 1000 ? text[..1000] : text,
                FormName: "WhatsApp")), ct);

            if (res.IsSuccess && res.Value.LeadId is { } leadId)
            {
                conv.LinkTo("lead", leadId, name);
                await db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex) { log.LogWarning(ex, "Could not create a CRM lead from a WhatsApp message"); }
    }

    private async Task AutoReplyAsync(WaConnection conn, WaConversation conv, string text, bool isNew, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        string? reply = null;
        Action? mark = null;

        var rule = (await db.KeywordRules.AsNoTracking().Where(k => k.IsActive).ToListAsync(ct))
            .FirstOrDefault(k => k.Matches(text));

        if (rule is not null) reply = rule.Reply;
        else if (conn.AwayEnabled && conn.AwayMessage is not null && !IsOpen(conn, now)
                 && (conv.LastAwayAt is null || now - conv.LastAwayAt > TimeSpan.FromHours(12)))
        {
            reply = conn.AwayMessage;
            mark = () => conv.MarkAwaySent(now);
        }
        else if (isNew && conn.WelcomeEnabled && conn.WelcomeMessage is not null)
        {
            reply = conn.WelcomeMessage;
            mark = () => conv.MarkWelcomed(now);
        }

        if (reply is null) return;
        reply = reply.Replace("{name}", conv.ContactName ?? "there", StringComparison.OrdinalIgnoreCase);

        mark?.Invoke();
        var sent = await sender.SendAsync(new WaSendRequest(conv.ContactPhone, reply, null, null, null, WaOrigin.AutoReply,
            UserName: "Auto-reply"), ct);
        if (sent.IsFailure) log.LogWarning("WhatsApp auto-reply failed: {Error}", sent.Error.Description);
    }

    private static bool IsOpen(WaConnection c, DateTime nowUtc)
    {
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(c.TimeZoneId); } catch { tz = TimeZoneInfo.Utc; }
        var local = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, tz);
        if (!ConnectionView.ParseDays(c.WorkDays).Contains((int)local.DayOfWeek)) return false;
        var t = local.ToString("HH:mm");
        return string.CompareOrdinal(t, c.OpensAt) >= 0 && string.CompareOrdinal(t, c.ClosesAt) < 0;
    }

    private async Task NotifyAsync(Guid tenantId, WaConversation conv, string text, CancellationToken ct)
    {
        try
        {
            var people = await recipients.WithPermissionAsync(tenantId, "messaging.inbox.view", ct);
            var who = conv.ContactName ?? $"+{conv.ContactPhone}";
            await notifications.PublishManyAsync(people.Select(u => new NotificationRequest(
                u, "messaging", "whatsapp.message", $"WhatsApp from {who}",
                text.Length > 140 ? text[..140] + "…" : text,
                $"/whatsapp/inbox?c={conv.Id}", "info", "whatsapp", conv.Id, tenantId)), ct);
        }
        catch (Exception ex) { log.LogWarning(ex, "WhatsApp inbound notification failed"); }
    }
}

/// <summary>
/// Meta's subscribe handshake. The GET carries only the verify token, so the token itself says which
/// workspace (or the shared Vrodux app) is subscribing.
/// </summary>
internal sealed class VerifyWaWebhookTokenHandler(MessagingDbContext db, IConfiguration config)
    : IQueryHandler<VerifyWaWebhookTokenQuery, bool>
{
    public async Task<Result<bool>> Handle(VerifyWaWebhookTokenQuery q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q.Token)) return false;

        var shared = config["Messaging:WhatsApp:VerifyToken"];
        if (!string.IsNullOrEmpty(shared)
            && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(q.Token), Encoding.UTF8.GetBytes(shared)))
            return true;

        // Workspace tokens are 160 random bits, so an exact indexed lookup is safe.
        return await db.Connections.IgnoreQueryFilters().AnyAsync(c => c.WebhookVerifyToken == q.Token, ct);
    }
}
