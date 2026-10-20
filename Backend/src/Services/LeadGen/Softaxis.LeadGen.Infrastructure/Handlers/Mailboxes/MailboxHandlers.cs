using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Mailboxes;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Mail;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Mailboxes;

internal static class MailboxMapping
{
    public static MailboxDto ToDto(Mailbox m, PlatformSettings cfg)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var sent = m.SentTodayDate == today ? m.SentToday : 0;
        var limit = Math.Min(m.DailyLimit, Warmup.DailyLimit(m.WarmupStartedAt, now, cfg.MaxDailySendsPerMailbox));
        var day = m.WarmupStartedAt is { } w ? Math.Max(1, (int)(now.Date - w.Date).TotalDays + 1) : 0;
        var rate = m.TotalSent == 0 ? 0 : Math.Round(m.TotalBounced * 100.0 / m.TotalSent, 1);
        return new MailboxDto(m.Id, m.Provider, m.Address, m.DisplayName, m.Status, m.StatusReason, m.DailyLimit, limit, sent,
            Math.Max(0, limit - sent), day, m.TotalSent, m.TotalBounced, m.TotalReplies, rate, m.LastSyncAt, m.LastSentAt,
            m.LastError, m.SignatureText, m.OwnerUserId, m.CreatedAt);
    }

    public static async Task<Error?> CheckLimitAsync(LeadGenDbContext db, PlatformSettings cfg, CancellationToken ct)
    {
        var count = await db.Mailboxes.CountAsync(m => !m.IsDeleted, ct);
        return count >= cfg.MaxMailboxesPerWorkspace
            ? Error.Custom("Mailbox.Conflict", $"You can connect at most {cfg.MaxMailboxesPerWorkspace} mailboxes.")
            : null;
    }
}

internal sealed class GetMailboxesHandler(LeadGenDbContext db, IPlatformSettings settings) : IQueryHandler<GetMailboxesQuery, IReadOnlyList<MailboxDto>>
{
    public async Task<Result<IReadOnlyList<MailboxDto>>> Handle(GetMailboxesQuery q, CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        var rows = await db.Mailboxes.AsNoTracking().Where(m => !m.IsDeleted).OrderBy(m => m.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<MailboxDto>>(rows.Select(m => MailboxMapping.ToDto(m, cfg)).ToList());
    }
}

internal sealed class GetMailboxProvidersHandler(IMailboxAuth auth) : IQueryHandler<GetMailboxProvidersQuery, MailboxProvidersDto>
{
    public Task<Result<MailboxProvidersDto>> Handle(GetMailboxProvidersQuery q, CancellationToken ct) =>
        Task.FromResult(Result.Success(new MailboxProvidersDto(auth.GoogleConfigured, auth.MicrosoftConfigured, true)));
}

internal sealed class ConnectImapHandler(
    LeadGenDbContext db, IPlatformSettings settings, IMailboxAuth auth, ImapSmtpTransport imap, ICurrentUser user)
    : ICommandHandler<ConnectImapCommand, MailboxDto>
{
    public async Task<Result<MailboxDto>> Handle(ConnectImapCommand cmd, CancellationToken ct)
    {
        if (user.Id is not { } me) return Result.Failure<MailboxDto>(Error.Custom("Auth.Unresolved", "Sign in again."));
        var i = cmd.Input;
        var cfg = await settings.GetAsync(ct);
        if (await MailboxMapping.CheckLimitAsync(db, cfg, ct) is { } limit) return Result.Failure<MailboxDto>(limit);

        var address = i.Address.Trim().ToLowerInvariant();
        if (await db.Mailboxes.AnyAsync(m => !m.IsDeleted && m.Address == address, ct))
            return Result.Failure<MailboxDto>(Error.Custom("Mailbox.Duplicate", "That mailbox is already connected."));

        var creds = new MailCredentials(Guid.Empty, MailboxProvider.Imap, address, i.DisplayName, null, i.Password, i.Username.Trim(),
            i.SmtpHost.Trim(), i.SmtpPort, i.ImapHost.Trim(), i.ImapPort);

        // Prove the login works before saving anything. A mailbox that cannot sign in is worse than none.
        try { await imap.VerifyAsync(creds, ct); }
        catch (MailAuthException ex) { return Result.Failure<MailboxDto>(Error.Custom("Mailbox.Invalid", ex.Message)); }
        catch (MailRejectedException ex) { return Result.Failure<MailboxDto>(Error.Custom("Mailbox.Invalid", ex.Message)); }
        catch (MailTransientException ex) { return Result.Failure<MailboxDto>(Error.Custom("Mailbox.Invalid", ex.Message)); }

        var box = new Mailbox(me, MailboxProvider.Imap, address, i.DisplayName);
        box.SetServers(i.SmtpHost, i.SmtpPort, i.ImapHost, i.ImapPort, i.Username);
        box.SetCredentials(auth.ProtectPassword(i.Password));
        box.MarkConnected();
        db.Mailboxes.Add(box);
        await db.SaveChangesAsync(ct);
        return Result.Success(MailboxMapping.ToDto(box, cfg));
    }
}

internal sealed class StartMailboxOAuthHandler(
    LeadGenDbContext db, IPlatformSettings settings, IMailboxAuth auth, ISecretProtector protector, ICurrentUser user)
    : ICommandHandler<StartMailboxOAuthCommand, OAuthUrlDto>
{
    public async Task<Result<OAuthUrlDto>> Handle(StartMailboxOAuthCommand cmd, CancellationToken ct)
    {
        if (user.Id is not { } me || TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<OAuthUrlDto>(Error.Custom("Auth.Unresolved", "Sign in again."));
        if (!auth.IsConfigured(cmd.Provider))
            return Result.Failure<OAuthUrlDto>(Error.Custom("Mailbox.NotConfigured",
                $"Signing in with {(cmd.Provider == MailboxProvider.Google ? "Google" : "Microsoft")} is not set up on this server yet. Use a mailbox with SMTP and IMAP instead, or ask your administrator."));

        var cfg = await settings.GetAsync(ct);
        if (await MailboxMapping.CheckLimitAsync(db, cfg, ct) is { } limit) return Result.Failure<OAuthUrlDto>(limit);

        // The callback is anonymous (the provider redirects a browser with no token), so who and where
        // travel inside the sealed state. It expires in ten minutes.
        var state = protector.Protect(JsonSerializer.Serialize(new OAuthState(tenantId, me, cmd.Provider, cmd.ReturnPath, DateTime.UtcNow.AddMinutes(10))))!;
        return Result.Success(new OAuthUrlDto(auth.BuildAuthUrl(cmd.Provider, cmd.CallbackUri, state)));
    }
}

internal sealed record OAuthState(Guid TenantId, Guid UserId, string Provider, string ReturnPath, DateTime ExpiresAt);

internal sealed class MailboxOAuthCallbackHandler(
    LeadGenDbContext db, IPlatformSettings settings, IMailboxAuth auth, ISecretProtector protector)
    : ICommandHandler<MailboxOAuthCallbackCommand, OAuthResultDto>
{
    public async Task<Result<OAuthResultDto>> Handle(MailboxOAuthCallbackCommand cmd, CancellationToken ct)
    {
        OAuthState? state;
        try { state = JsonSerializer.Deserialize<OAuthState>(protector.Unprotect(cmd.State)!); } catch { state = null; }
        if (state is null || state.ExpiresAt < DateTime.UtcNow)
            return Result.Success(new OAuthResultDto(false, null, "/lead-generation/mailboxes", "The sign-in link expired. Please try again."));

        var returnPath = state.ReturnPath.StartsWith('/') && !state.ReturnPath.StartsWith("//") ? state.ReturnPath : "/lead-generation/mailboxes";
        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try
        {
            // No signed-in user on this request, so act inside the workspace the state names.
            TenantAmbient.Set(state.TenantId, isSuperAdmin: false, isResolved: true);

            var tokens = await auth.ExchangeCodeAsync(state.Provider, cmd.Code, cmd.CallbackUri, ct);
            if (string.IsNullOrEmpty(tokens.RefreshToken))
                return Result.Success(new OAuthResultDto(false, null, returnPath,
                    "Permission to stay connected was not granted. Remove the app from your account's connected apps and try again."));

            var address = (await auth.GetAccountEmailAsync(state.Provider, tokens.AccessToken, ct))?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(address))
                return Result.Success(new OAuthResultDto(false, null, returnPath, "Could not read the account's email address."));

            var cfg = await settings.GetAsync(ct);
            var box = await db.Mailboxes.FirstOrDefaultAsync(m => !m.IsDeleted && m.Address == address, ct);
            if (box is null)
            {
                if (await MailboxMapping.CheckLimitAsync(db, cfg, ct) is { } limit)
                    return Result.Success(new OAuthResultDto(false, address, returnPath, limit.Description));
                box = new Mailbox(state.UserId, state.Provider, address, null);
                db.Mailboxes.Add(box);
            }
            box.SetCredentials(auth.ProtectOAuth(tokens));
            box.MarkConnected();
            box.SetSyncCursor(null);
            await db.SaveChangesAsync(ct);
            return Result.Success(new OAuthResultDto(true, address, returnPath, null));
        }
        catch (Exception ex) when (ex is MailAuthException or MailTransientException or HttpRequestException)
        {
            return Result.Success(new OAuthResultDto(false, null, returnPath, "Could not complete the sign-in. Please try again."));
        }
        finally
        {
            if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true);
            else TenantAmbient.Clear();
        }
    }
}

internal sealed class UpdateMailboxHandler(LeadGenDbContext db, IPlatformSettings settings) : ICommandHandler<UpdateMailboxCommand, MailboxDto>
{
    public async Task<Result<MailboxDto>> Handle(UpdateMailboxCommand cmd, CancellationToken ct)
    {
        var m = await db.Mailboxes.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure<MailboxDto>(Error.NotFoundById("Mailbox", cmd.Id));
        var cfg = await settings.GetAsync(ct);
        if (cmd.DailyLimit > cfg.MaxDailySendsPerMailbox)
            return Result.Failure<MailboxDto>(Error.Custom("Mailbox.Invalid", $"The daily limit cannot exceed {cfg.MaxDailySendsPerMailbox}."));
        m.SetLimits(cmd.DailyLimit, cmd.SignatureText, cmd.DisplayName);
        await db.SaveChangesAsync(ct);
        return Result.Success(MailboxMapping.ToDto(m, cfg));
    }
}

internal sealed class PauseMailboxHandler(LeadGenDbContext db) : ICommandHandler<PauseMailboxCommand>
{
    public async Task<Result> Handle(PauseMailboxCommand cmd, CancellationToken ct)
    {
        var m = await db.Mailboxes.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure(Error.NotFoundById("Mailbox", cmd.Id));
        m.Pause("Paused by you.");
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class ResumeMailboxHandler(LeadGenDbContext db) : ICommandHandler<ResumeMailboxCommand>
{
    public async Task<Result> Handle(ResumeMailboxCommand cmd, CancellationToken ct)
    {
        var m = await db.Mailboxes.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure(Error.NotFoundById("Mailbox", cmd.Id));
        if (m.Status == MailboxStatus.Error)
            return Result.Failure(Error.Custom("Mailbox.Conflict", "This mailbox needs to be reconnected, not resumed."));
        m.Resume();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DisconnectMailboxHandler(LeadGenDbContext db) : ICommandHandler<DisconnectMailboxCommand>
{
    public async Task<Result> Handle(DisconnectMailboxCommand cmd, CancellationToken ct)
    {
        var m = await db.Mailboxes.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure(Error.NotFoundById("Mailbox", cmd.Id));

        foreach (var c in await db.Campaigns.Where(c => c.MailboxId == m.Id && !c.IsDeleted && (c.Status == CampaignStatus.Active)).ToListAsync(ct))
            c.Pause("Its mailbox was disconnected.");
        m.Delete();   // soft: the conversations it carried stay readable
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SendTestEmailHandler(
    LeadGenDbContext db, IMailboxAuth auth, IMailTransportFactory transports, IOutreachPolicy policy, IMemoryCache cache)
    : ICommandHandler<SendTestEmailCommand>
{
    public async Task<Result> Handle(SendTestEmailCommand cmd, CancellationToken ct)
    {
        var m = await db.Mailboxes.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (m is null) return Result.Failure(Error.NotFoundById("Mailbox", cmd.Id));
        if (!m.CanSend) return Result.Failure(Error.Custom("Mailbox.Conflict", "This mailbox is not connected."));

        // A test email must not become a way to send to strangers.
        var key = $"leadgen:test:{m.Id}:{DateTime.UtcNow:yyyyMMdd}";
        var used = cache.GetOrCreate(key, e => { e.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24); return 0; });
        if (used >= 5) return Result.Failure(Error.Custom("Mailbox.Conflict", "You can send up to 5 test emails a day per mailbox."));

        var gate = await policy.CanSendAsync(ct);
        if (!gate.Ok) return Result.Failure(Error.Custom("Mailbox.Conflict", gate.Reason!));

        try
        {
            var creds = await auth.ResolveAsync(m, ct);
            var domain = m.Address[(m.Address.IndexOf('@') + 1)..];
            var body = "This is a test email from Vrodux Lead Generation.\n\nIf you can read this, your mailbox is connected and ready to send.";
            await transports.For(m.Provider).SendAsync(creds, new OutgoingEmail(
                m.Address, m.DisplayName, cmd.To.Trim(), null, "Test email from Vrodux", body, EmailRenderer.ReplyHtml(body),
                $"<{Guid.NewGuid():N}@{domain}>", null, [], null, null, null), ct);
            cache.Set(key, used + 1, TimeSpan.FromHours(24));
            await db.SaveChangesAsync(ct);   // persists a refreshed access token, if one was issued
            return Result.Success();
        }
        catch (MailAuthException ex)
        {
            m.MarkError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure(Error.Custom("Mailbox.Conflict", ex.Message));
        }
        catch (Exception ex) when (ex is MailRejectedException or MailTransientException)
        {
            return Result.Failure(Error.Custom("Mailbox.Conflict", ex.Message));
        }
    }
}

internal sealed class SyncMailboxNowHandler(IOutreachEngine engine) : ICommandHandler<SyncMailboxNowCommand, SyncResultDto>
{
    public async Task<Result<SyncResultDto>> Handle(SyncMailboxNowCommand cmd, CancellationToken ct)
    {
        var r = await engine.SyncMailboxAsync(cmd.Id, ct);
        return Result.Success(new SyncResultDto(r.Received, r.Replies, r.Bounces));
    }
}
