using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Messaging.Application.Abstractions;
using Softaxis.Messaging.Application.WhatsApp;
using Softaxis.Messaging.Domain.Entities;
using Softaxis.Messaging.Infrastructure.Persistence;

namespace Softaxis.Messaging.Infrastructure.Services;

/// <summary>
/// Sends through the current workspace's own number. The tenant comes from the ambient context
/// (the signed-in request, or the background job that set it), so one workspace can never send
/// from another's number. The message row is saved before the API call, so a crash in between
/// leaves a visible "queued" row rather than a message nobody knows was sent.
/// </summary>
public sealed class WhatsAppSender(MessagingDbContext db, IWhatsAppClient client, IMessagingSecretProtector secrets)
    : IWhatsAppSender
{
    public async Task<Result<WaSendResultDto>> SendAsync(WaSendRequest r, CancellationToken ct)
    {
        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        if (conn is null || conn.Status == WaConnectionStatus.Disconnected)
            return Fail("WhatsApp.NotConnected.Conflict", "WhatsApp is not connected for this workspace. Connect it in Settings → WhatsApp.");

        var token = secrets.Unprotect(conn.AccessTokenCipher);
        if (token is null)
            return Fail("WhatsApp.Token.Conflict", "The stored WhatsApp access token can no longer be read. Reconnect WhatsApp.");

        var to = WaPhone.Normalize(r.To, conn.DefaultCountryCode);
        if (to is null)
            return Fail("Validation.Failed", $"'{r.To}' is not a phone number WhatsApp can reach. Include the country code.");

        var conv = await db.Conversations.FirstOrDefaultAsync(c => c.ContactPhone == to, ct);
        if (conv is null)
        {
            conv = new WaConversation(to, r.ContactName);
            db.Conversations.Add(conv);
        }
        conv.SetName(r.ContactName);
        conv.LinkTo(r.RelatedType, r.RelatedId, r.RelatedName);

        if (conv.OptedOut)
            return Fail("WhatsApp.OptedOut.Conflict", "This contact asked not to receive WhatsApp messages. Nothing was sent.");

        var now = DateTime.UtcNow;
        string body, type;
        WaTemplate? template = null;
        var variables = r.Variables ?? [];

        if (!string.IsNullOrWhiteSpace(r.TemplateName))
        {
            var lang = string.IsNullOrWhiteSpace(r.Language) ? null : r.Language;
            template = await db.Templates
                .Where(t => t.Name == r.TemplateName && (lang == null || t.Language == lang))
                .OrderBy(t => t.Language)
                .FirstOrDefaultAsync(ct);
            if (template is null)
                return Fail("WhatsApp.Template.NotFound", $"Template '{r.TemplateName}' was not found. Sync templates and try again.");
            if (template.Status != "APPROVED")
                return Fail("WhatsApp.Template.Conflict", $"Template '{template.Name}' is {template.Status.ToLowerInvariant()} at Meta and cannot be sent yet.");
            if (variables.Count < template.VariableCount)
                return Fail("Validation.Failed", $"Template '{template.Name}' needs {template.VariableCount} value(s); {variables.Count} given.");

            body = Fill(template.BodyText, variables);
            type = "template";
        }
        else
        {
            // Meta only allows free text inside 24 hours of the contact's last message.
            if (!conv.WindowOpen(now))
                return Fail("WhatsApp.Window.Conflict",
                    "This contact has not written in the last 24 hours, so WhatsApp only allows an approved template. Choose a template.");
            body = r.Text!.Trim();
            type = "text";
        }

        var msg = new WaMessage(conv.Id, "out", type, body);
        msg.Describe(r.Origin, template?.Name, r.UserId, r.UserName, r.RelatedType, r.RelatedId);
        db.Messages.Add(msg);
        conv.RecordOutbound(body, now);
        await db.SaveChangesAsync(ct);

        var result = template is not null
            ? await client.SendTemplateAsync(conn.PhoneNumberId, token, to, template.Name, template.Language,
                variables.Take(template.VariableCount).ToList(), ct)
            : await client.SendTextAsync(conn.PhoneNumberId, token, to, body, ct);

        if (result.Ok) { msg.MarkSent(result.Value!); conn.MarkHealthy(); }
        else
        {
            msg.MarkFailed(result.Error!);
            // An auth failure means the connection itself is broken, not just this message.
            if (result.Error!.Contains("code 190", StringComparison.Ordinal)) conn.MarkError(result.Error);
        }
        await db.SaveChangesAsync(ct);

        return new WaSendResultDto(msg.Id, conv.Id, msg.Status, msg.Error);
    }

    /// <summary>Replaces {{1}}, {{2}}, … with the given values, for the log and the preview.</summary>
    public static string Fill(string body, IReadOnlyList<string> values) =>
        Regex.Replace(body, @"\{\{(\d+)\}\}", m =>
        {
            var i = int.Parse(m.Groups[1].Value) - 1;
            return i >= 0 && i < values.Count ? values[i] : m.Value;
        });

    public static int CountVariables(string body) =>
        Regex.Matches(body, @"\{\{(\d+)\}\}").Select(m => int.Parse(m.Groups[1].Value)).DefaultIfEmpty(0).Max();

    private static Result<WaSendResultDto> Fail(string code, string message) =>
        Result.Failure<WaSendResultDto>(Error.Custom(code, message));
}

internal static class WaMap
{
    public static WaConversationDto ToDto(this WaConversation c)
    {
        var now = DateTime.UtcNow;
        var open = c.WindowOpen(now);
        return new WaConversationDto(c.Id, c.ContactPhone, c.ContactName, c.RelatedType, c.RelatedId, c.RelatedName,
            c.LastMessageAt, c.LastMessagePreview, c.UnreadCount, c.OptedOut, open,
            open ? c.LastInboundAt!.Value.AddHours(24) : null);
    }

    public static WaMessageDto ToDto(this WaMessage m) =>
        new(m.Id, m.ConversationId, m.Direction, m.Type, m.Body, m.TemplateName, m.Status, m.Error, m.Origin,
            m.SentByName, m.CreatedAt, m.StatusAt);

    public static WaTemplateDto ToDto(this WaTemplate t) =>
        new(t.Id, t.Name, t.Language, t.Category, t.Status, t.HeaderText, t.BodyText, t.FooterText,
            t.VariableCount, t.RejectedReason, t.SyncedAt);

    public static WaKeywordRuleDto ToDto(this WaKeywordRule k) => new(k.Id, k.Keyword, k.MatchType, k.Reply, k.IsActive);
}
