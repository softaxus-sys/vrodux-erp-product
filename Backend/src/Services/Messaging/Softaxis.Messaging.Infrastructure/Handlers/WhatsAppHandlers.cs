using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Messaging.Application.Abstractions;
using Softaxis.Messaging.Application.WhatsApp;
using Softaxis.Messaging.Domain.Entities;
using Softaxis.Messaging.Infrastructure.Persistence;
using Softaxis.Messaging.Infrastructure.Services;

namespace Softaxis.Messaging.Infrastructure.Handlers;

internal static class ConnectionView
{
    /// <param name="showSetup">Include the verify token: only for people who can see WhatsApp setup.</param>
    public static WaConnectionDto Build(WaConnection? c, IConfiguration config, bool showSetup = true)
    {
        var baseUrl = (config["Messaging:WhatsApp:PublicBaseUrl"] ?? config["Integrations:PublicBaseUrl"] ?? "").TrimEnd('/');
        var webhook = $"{baseUrl}/api/webhooks/whatsapp";
        // "Shared app" = the server has its own Meta app secret + verify token (the Vrodux / Tech Provider app).
        var configured = !string.IsNullOrWhiteSpace(config["Messaging:WhatsApp:VerifyToken"])
                      && !string.IsNullOrWhiteSpace(config["Messaging:WhatsApp:AppSecret"]);
        var ownSecret = !string.IsNullOrEmpty(c?.AppSecretCipher);

        var auto = c is null
            ? new WaAutoReplyDto(false, null, false, null, "Asia/Dubai", "09:00", "18:00", [1, 2, 3, 4, 5], true, "971")
            : new WaAutoReplyDto(c.WelcomeEnabled, c.WelcomeMessage, c.AwayEnabled, c.AwayMessage, c.TimeZoneId,
                c.OpensAt, c.ClosesAt, ParseDays(c.WorkDays), c.CreateLeads, c.DefaultCountryCode);

        return new WaConnectionDto(c is not null && c.Status != WaConnectionStatus.Disconnected, c?.Status,
            c?.PhoneNumberId, c?.WabaId, c?.DisplayPhone, c?.VerifiedName, c?.LastError, c?.ConnectedAt,
            webhook, configured || ownSecret, auto,
            showSetup ? c?.WebhookVerifyToken : null, ownSecret, configured,
            c is not null && (ownSecret || configured));
    }

    public static IReadOnlyList<int> ParseDays(string s) =>
        s.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => int.TryParse(x, out var d) ? d : -1)
         .Where(d => d is >= 0 and <= 6).Distinct().OrderBy(d => d).ToList();
}

// ── Connection ───────────────────────────────────────────────────────────────

internal sealed class GetWaConnectionHandler(MessagingDbContext db, IConfiguration config, ICurrentUser user)
    : IQueryHandler<GetWaConnectionQuery, WaConnectionDto>
{
    public async Task<Result<WaConnectionDto>> Handle(GetWaConnectionQuery q, CancellationToken ct)
    {
        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        // Connections made before verify tokens existed get one the first time anyone looks.
        if (conn is not null && conn.EnsureVerifyToken()) await db.SaveChangesAsync(ct);
        return ConnectionView.Build(conn, config, user.IsSuperAdmin || user.HasPermission("messaging.settings.view"));
    }
}

internal sealed class SetWaAppSecretHandler(MessagingDbContext db, IMessagingSecretProtector secrets, IConfiguration config)
    : ICommandHandler<SetWaAppSecretCommand, WaConnectionDto>
{
    public async Task<Result<WaConnectionDto>> Handle(SetWaAppSecretCommand c, CancellationToken ct)
    {
        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        if (conn is null)
            return Result.Failure<WaConnectionDto>(Error.Custom("WhatsApp.NotConnected.Conflict", "Connect WhatsApp first."));

        if (string.IsNullOrWhiteSpace(c.AppSecret)) conn.ClearAppSecret();
        else conn.SetAppSecret(secrets.Protect(c.AppSecret.Trim().ToLowerInvariant()));
        conn.EnsureVerifyToken();
        await db.SaveChangesAsync(ct);
        return ConnectionView.Build(conn, config);
    }
}

internal sealed class ConnectWaHandler(MessagingDbContext db, IWhatsAppClient client, IMessagingSecretProtector secrets,
    IConfiguration config) : ICommandHandler<ConnectWaCommand, WaConnectionDto>
{
    public async Task<Result<WaConnectionDto>> Handle(ConnectWaCommand cmd, CancellationToken ct)
    {
        var token = cmd.AccessToken.Trim();

        // Prove the details work before saving them: a connection that cannot send is worse than none.
        var profile = await client.GetPhoneProfileAsync(cmd.PhoneNumberId.Trim(), token, ct);
        if (!profile.Ok)
            return Result.Failure<WaConnectionDto>(Error.Custom("WhatsApp.Connect.Conflict",
                $"Meta refused these details: {profile.Error}"));

        // A number belongs to one workspace. The unique index enforces it; this gives a readable message.
        var claimed = await db.Connections.IgnoreQueryFilters()
            .AnyAsync(c => c.PhoneNumberId == cmd.PhoneNumberId.Trim()
                           && EF.Property<Guid?>(c, "TenantId") != Softaxis.BuildingBlocks.Domain.Multitenancy.TenantAmbient.TenantId, ct);
        if (claimed)
            return Result.Failure<WaConnectionDto>(Error.Custom("WhatsApp.Connect.Duplicate",
                "This WhatsApp number is already connected to another workspace."));

        var cipher = secrets.Protect(token);
        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        if (conn is null)
        {
            conn = new WaConnection(cmd.PhoneNumberId, cmd.WabaId, cipher);
            db.Connections.Add(conn);
        }
        else conn.Reconnect(cmd.PhoneNumberId, cmd.WabaId, cipher);

        conn.SetProfile(profile.Value!.DisplayPhone, profile.Value.VerifiedName);
        if (!string.IsNullOrWhiteSpace(cmd.AppSecret)) conn.SetAppSecret(secrets.Protect(cmd.AppSecret.Trim().ToLowerInvariant()));
        conn.EnsureVerifyToken();
        await db.SaveChangesAsync(ct);

        // Templates are the first thing anyone needs after connecting; failing to fetch them is not fatal.
        await TemplateSync.RunAsync(db, client, conn, token, ct);

        return ConnectionView.Build(conn, config);
    }
}

internal sealed class DisconnectWaHandler(MessagingDbContext db) : ICommandHandler<DisconnectWaCommand>
{
    public async Task<Result> Handle(DisconnectWaCommand cmd, CancellationToken ct)
    {
        // Removed rather than flagged, so the number is free to connect elsewhere. History stays.
        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        if (conn is not null)
        {
            db.Connections.Remove(conn);
            await db.SaveChangesAsync(ct);
        }
        return Result.Success();
    }
}

internal sealed class UpdateWaAutoRepliesHandler(MessagingDbContext db, IConfiguration config)
    : ICommandHandler<UpdateWaAutoRepliesCommand, WaConnectionDto>
{
    public async Task<Result<WaConnectionDto>> Handle(UpdateWaAutoRepliesCommand c, CancellationToken ct)
    {
        try { TimeZoneInfo.FindSystemTimeZoneById(c.TimeZoneId); }
        catch { return Result.Failure<WaConnectionDto>(Error.Custom("Validation.Failed", $"Unknown time zone '{c.TimeZoneId}'.")); }

        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        if (conn is null)
            return Result.Failure<WaConnectionDto>(Error.Custom("WhatsApp.NotConnected.Conflict", "Connect WhatsApp first."));

        conn.UpdateAutoReplies(c.WelcomeEnabled, c.WelcomeMessage, c.AwayEnabled, c.AwayMessage, c.TimeZoneId,
            c.OpensAt, c.ClosesAt, string.Join(',', c.WorkDays.Distinct().OrderBy(d => d)), c.CreateLeads,
            c.DefaultCountryCode);
        await db.SaveChangesAsync(ct);
        return ConnectionView.Build(conn, config);
    }
}

// ── Templates ────────────────────────────────────────────────────────────────

internal static class TemplateSync
{
    /// <returns>Null on success, otherwise Meta's error.</returns>
    public static async Task<string?> RunAsync(MessagingDbContext db, IWhatsAppClient client, WaConnection conn,
        string token, CancellationToken ct)
    {
        var remote = await client.GetTemplatesAsync(conn.WabaId, token, ct);
        if (!remote.Ok) return remote.Error;

        var local = await db.Templates.ToListAsync(ct);
        foreach (var r in remote.Value!)
        {
            var t = local.FirstOrDefault(x => x.Name == r.Name && x.Language == r.Language);
            if (t is null) { t = new WaTemplate(r.Name, r.Language); db.Templates.Add(t); local.Add(t); }
            t.Apply(r.Id, r.Category, r.Status, r.Header, r.Body, r.Footer, WhatsAppSender.CountVariables(r.Body), r.RejectedReason);
        }

        // Deleted at Meta → deleted here; sending one would only fail.
        foreach (var gone in local.Where(l => !remote.Value!.Any(r => r.Name == l.Name && r.Language == l.Language)))
            db.Templates.Remove(gone);

        await db.SaveChangesAsync(ct);
        return null;
    }
}

internal sealed class GetWaTemplatesHandler(MessagingDbContext db) : IQueryHandler<GetWaTemplatesQuery, IReadOnlyList<WaTemplateDto>>
{
    public async Task<Result<IReadOnlyList<WaTemplateDto>>> Handle(GetWaTemplatesQuery q, CancellationToken ct)
    {
        var query = db.Templates.AsNoTracking();
        if (q.ApprovedOnly) query = query.Where(t => t.Status == "APPROVED");
        var list = await query.OrderBy(t => t.Name).ThenBy(t => t.Language).ToListAsync(ct);
        return list.Select(t => t.ToDto()).ToList();
    }
}

internal sealed class SyncWaTemplatesHandler(MessagingDbContext db, IWhatsAppClient client, IMessagingSecretProtector secrets)
    : ICommandHandler<SyncWaTemplatesCommand, IReadOnlyList<WaTemplateDto>>
{
    public async Task<Result<IReadOnlyList<WaTemplateDto>>> Handle(SyncWaTemplatesCommand cmd, CancellationToken ct)
    {
        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        var token = conn is null ? null : secrets.Unprotect(conn.AccessTokenCipher);
        if (conn is null || token is null)
            return Result.Failure<IReadOnlyList<WaTemplateDto>>(Error.Custom("WhatsApp.NotConnected.Conflict", "Connect WhatsApp first."));

        var error = await TemplateSync.RunAsync(db, client, conn, token, ct);
        if (error is not null)
            return Result.Failure<IReadOnlyList<WaTemplateDto>>(Error.Custom("WhatsApp.Sync.Conflict", $"Meta refused: {error}"));

        var list = await db.Templates.AsNoTracking().OrderBy(t => t.Name).ToListAsync(ct);
        return list.Select(t => t.ToDto()).ToList();
    }
}

internal sealed class CreateWaTemplateHandler(MessagingDbContext db, IWhatsAppClient client, IMessagingSecretProtector secrets)
    : ICommandHandler<CreateWaTemplateCommand, WaTemplateDto>
{
    public async Task<Result<WaTemplateDto>> Handle(CreateWaTemplateCommand c, CancellationToken ct)
    {
        var conn = await db.Connections.FirstOrDefaultAsync(ct);
        var token = conn is null ? null : secrets.Unprotect(conn.AccessTokenCipher);
        if (conn is null || token is null)
            return Result.Failure<WaTemplateDto>(Error.Custom("WhatsApp.NotConnected.Conflict", "Connect WhatsApp first."));

        if (await db.Templates.AnyAsync(t => t.Name == c.Name && t.Language == c.Language, ct))
            return Result.Failure<WaTemplateDto>(Error.Custom("WhatsApp.Template.Duplicate",
                $"A template named '{c.Name}' in this language already exists."));

        var count = WhatsAppSender.CountVariables(c.BodyText);
        var examples = Enumerable.Range(0, count)
            .Select(i => c.Examples is not null && i < c.Examples.Count && !string.IsNullOrWhiteSpace(c.Examples[i]) ? c.Examples[i] : $"Sample {i + 1}")
            .ToList();

        var res = await client.CreateTemplateAsync(conn.WabaId, token,
            new WaNewTemplate(c.Name, c.Language, c.Category, c.HeaderText, c.BodyText, c.FooterText, examples), ct);
        if (!res.Ok)
            return Result.Failure<WaTemplateDto>(Error.Custom("WhatsApp.Template.Conflict", $"Meta refused the template: {res.Error}"));

        var t = new WaTemplate(c.Name, c.Language);
        t.Apply(null, c.Category, res.Value!, c.HeaderText, c.BodyText, c.FooterText, count, null);
        db.Templates.Add(t);
        await db.SaveChangesAsync(ct);
        return t.ToDto();
    }
}

// ── Sending ──────────────────────────────────────────────────────────────────

internal sealed class SendWaMessageHandler(IWhatsAppSender sender, ICurrentUser user)
    : ICommandHandler<SendWaMessageCommand, WaSendResultDto>
{
    public Task<Result<WaSendResultDto>> Handle(SendWaMessageCommand c, CancellationToken ct) =>
        sender.SendAsync(new WaSendRequest(c.To, c.Text, c.TemplateName, c.Language, c.Variables, WaOrigin.Manual,
            c.RelatedType, c.RelatedId, c.RelatedName, c.ContactName, user.Id, user.Name), ct);
}

// ── Inbox ────────────────────────────────────────────────────────────────────

internal sealed class GetWaConversationsHandler(MessagingDbContext db)
    : IQueryHandler<GetWaConversationsQuery, IReadOnlyList<WaConversationDto>>
{
    public async Task<Result<IReadOnlyList<WaConversationDto>>> Handle(GetWaConversationsQuery q, CancellationToken ct)
    {
        var query = db.Conversations.AsNoTracking();
        if (q.UnreadOnly) query = query.Where(c => c.UnreadCount > 0);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            var digits = new string(s.Where(char.IsDigit).ToArray());
            query = query.Where(c => (c.ContactName != null && c.ContactName.Contains(s))
                                     || (c.RelatedName != null && c.RelatedName.Contains(s))
                                     || (digits.Length > 0 && c.ContactPhone.Contains(digits)));
        }
        var list = await query.OrderByDescending(c => c.LastMessageAt).Take(200).ToListAsync(ct);
        return list.Select(c => c.ToDto()).ToList();
    }
}

internal sealed class GetWaMessagesHandler(MessagingDbContext db) : IQueryHandler<GetWaMessagesQuery, IReadOnlyList<WaMessageDto>>
{
    public async Task<Result<IReadOnlyList<WaMessageDto>>> Handle(GetWaMessagesQuery q, CancellationToken ct)
    {
        if (!await db.Conversations.AnyAsync(c => c.Id == q.ConversationId, ct))
            return Result.Failure<IReadOnlyList<WaMessageDto>>(Error.Custom("WhatsApp.Conversation.NotFound", "Conversation not found."));

        var list = await db.Messages.AsNoTracking().Where(m => m.ConversationId == q.ConversationId)
            .OrderByDescending(m => m.CreatedAt).Take(500).ToListAsync(ct);
        return list.OrderBy(m => m.CreatedAt).Select(m => m.ToDto()).ToList();
    }
}

internal sealed class MarkWaConversationReadHandler(MessagingDbContext db) : ICommandHandler<MarkWaConversationReadCommand>
{
    public async Task<Result> Handle(MarkWaConversationReadCommand c, CancellationToken ct)
    {
        var conv = await db.Conversations.FirstOrDefaultAsync(x => x.Id == c.ConversationId, ct);
        if (conv is null) return Result.Failure(Error.Custom("WhatsApp.Conversation.NotFound", "Conversation not found."));
        conv.MarkRead();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetWaRecordThreadHandler(MessagingDbContext db) : IQueryHandler<GetWaRecordThreadQuery, WaRecordThreadDto>
{
    public async Task<Result<WaRecordThreadDto>> Handle(GetWaRecordThreadQuery q, CancellationToken ct)
    {
        // The chat for a record is the one linked to it, or failing that the chat with its phone number.
        var conv = await db.Conversations.AsNoTracking()
            .FirstOrDefaultAsync(c => c.RelatedType == q.RelatedType && c.RelatedId == q.RelatedId, ct);
        if (conv is null && !string.IsNullOrWhiteSpace(q.Phone))
        {
            var cc = await db.Connections.Select(c => c.DefaultCountryCode).FirstOrDefaultAsync(ct);
            var phone = WaPhone.Normalize(q.Phone, cc);
            if (phone is not null)
                conv = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(c => c.ContactPhone == phone, ct);
        }
        if (conv is null) return new WaRecordThreadDto(null, []);

        var msgs = await db.Messages.AsNoTracking().Where(m => m.ConversationId == conv.Id)
            .OrderByDescending(m => m.CreatedAt).Take(100).ToListAsync(ct);
        return new WaRecordThreadDto(conv.ToDto(), msgs.OrderBy(m => m.CreatedAt).Select(m => m.ToDto()).ToList());
    }
}

// ── Keyword rules ────────────────────────────────────────────────────────────

internal sealed class GetWaKeywordRulesHandler(MessagingDbContext db) : IQueryHandler<GetWaKeywordRulesQuery, IReadOnlyList<WaKeywordRuleDto>>
{
    public async Task<Result<IReadOnlyList<WaKeywordRuleDto>>> Handle(GetWaKeywordRulesQuery q, CancellationToken ct) =>
        (await db.KeywordRules.AsNoTracking().OrderBy(k => k.Keyword).ToListAsync(ct)).Select(k => k.ToDto()).ToList();
}

internal sealed class SaveWaKeywordRuleHandler(MessagingDbContext db) : ICommandHandler<SaveWaKeywordRuleCommand, WaKeywordRuleDto>
{
    public async Task<Result<WaKeywordRuleDto>> Handle(SaveWaKeywordRuleCommand c, CancellationToken ct)
    {
        WaKeywordRule rule;
        if (c.Id is { } id)
        {
            var found = await db.KeywordRules.FirstOrDefaultAsync(k => k.Id == id, ct);
            if (found is null) return Result.Failure<WaKeywordRuleDto>(Error.Custom("WhatsApp.Rule.NotFound", "Rule not found."));
            rule = found;
            rule.Update(c.Keyword, c.MatchType, c.Reply, c.IsActive);
        }
        else
        {
            rule = new WaKeywordRule(c.Keyword, c.MatchType, c.Reply);
            rule.Update(c.Keyword, c.MatchType, c.Reply, c.IsActive);
            db.KeywordRules.Add(rule);
        }
        await db.SaveChangesAsync(ct);
        return rule.ToDto();
    }
}

internal sealed class DeleteWaKeywordRuleHandler(MessagingDbContext db) : ICommandHandler<DeleteWaKeywordRuleCommand>
{
    public async Task<Result> Handle(DeleteWaKeywordRuleCommand c, CancellationToken ct)
    {
        var rule = await db.KeywordRules.FirstOrDefaultAsync(k => k.Id == c.Id, ct);
        if (rule is null) return Result.Failure(Error.Custom("WhatsApp.Rule.NotFound", "Rule not found."));
        db.KeywordRules.Remove(rule);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Automations ──────────────────────────────────────────────────────────────

internal static class AutomationCatalogue
{
    public sealed record Def(string Key, string Label, string Description, IReadOnlyList<string> Fields);

    public static readonly IReadOnlyList<Def> All =
    [
        new(WaEvents.LeadCreated, "New CRM lead",
            "Sends a template to every new lead that has a WhatsApp or phone number — from a form, a portal, an import or added by hand.",
            ["firstName", "lastName", "fullName", "company", "interestedIn", "source", "assignedTo"]),
    ];
}

internal sealed class GetWaAutomationsHandler(MessagingDbContext db) : IQueryHandler<GetWaAutomationsQuery, IReadOnlyList<WaAutomationDto>>
{
    public async Task<Result<IReadOnlyList<WaAutomationDto>>> Handle(GetWaAutomationsQuery q, CancellationToken ct)
    {
        var saved = await db.Automations.AsNoTracking().ToListAsync(ct);
        return AutomationCatalogue.All.Select(d =>
        {
            var a = saved.FirstOrDefault(s => s.EventKey == d.Key);
            return new WaAutomationDto(d.Key, d.Label, d.Description, a?.Enabled ?? false, a?.TemplateName, a?.Language,
                a is null || a.VariableFields.Length == 0 ? [] : a.VariableFields.Split('|'), d.Fields);
        }).ToList();
    }
}

internal sealed class SaveWaAutomationHandler(MessagingDbContext db) : ICommandHandler<SaveWaAutomationCommand, WaAutomationDto>
{
    public async Task<Result<WaAutomationDto>> Handle(SaveWaAutomationCommand c, CancellationToken ct)
    {
        var def = AutomationCatalogue.All.FirstOrDefault(d => d.Key == c.EventKey);
        if (def is null) return Result.Failure<WaAutomationDto>(Error.Custom("WhatsApp.Automation.NotFound", "Unknown automation."));

        var fields = c.VariableFields.Where(f => def.Fields.Contains(f)).ToList();
        if (c.Enabled)
        {
            var t = await db.Templates.FirstOrDefaultAsync(x => x.Name == c.TemplateName && x.Language == c.Language, ct);
            if (t is null)
                return Result.Failure<WaAutomationDto>(Error.Custom("Validation.Failed", "Choose a template to send."));
            if (t.Status != "APPROVED")
                return Result.Failure<WaAutomationDto>(Error.Custom("WhatsApp.Template.Conflict", "Only an approved template can be sent automatically."));
            if (fields.Count < t.VariableCount)
                return Result.Failure<WaAutomationDto>(Error.Custom("Validation.Failed",
                    $"The template has {t.VariableCount} placeholder(s); choose a field for each."));
        }

        var a = await db.Automations.FirstOrDefaultAsync(x => x.EventKey == c.EventKey, ct);
        if (a is null) { a = new WaAutomation(c.EventKey); db.Automations.Add(a); }
        a.Update(c.Enabled, c.TemplateName, c.Language, string.Join('|', fields));
        await db.SaveChangesAsync(ct);

        return new WaAutomationDto(def.Key, def.Label, def.Description, a.Enabled, a.TemplateName, a.Language, fields, def.Fields);
    }
}
