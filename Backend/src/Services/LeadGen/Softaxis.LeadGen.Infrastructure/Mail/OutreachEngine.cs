using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Application.Inbox;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Handlers.Setup;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Mail;

public sealed record SyncOutcome(int Received, int Replies, int Bounces);

/// <summary>
/// Everything that happens to email once a campaign is running: sending the next step to whoever is
/// due, and reacting to what comes back — replies, bounces, unsubscribes, auto-replies.
///
/// It is built to fail safe. Before every send it re-checks suppression, the prospect's status, the
/// platform and workspace limits and the mailbox's own daily allowance; a recipient is "claimed"
/// before sending so two passes cannot both send to them; and a failure is recorded against the
/// recipient rather than retried in a tight loop.
/// </summary>
public interface IOutreachEngine
{
    Task SendDueAsync(Guid tenantId, CancellationToken ct);
    Task<SyncOutcome> SyncMailboxAsync(Guid mailboxId, CancellationToken ct);
    Task<OutreachMessage> SendReplyAsync(OutreachThread thread, Mailbox mailbox, string text, CancellationToken ct);
    Task EvaluateHealthAsync(Mailbox mailbox, CancellationToken ct);
}

internal sealed class OutreachEngine(
    LeadGenDbContext db, IMailboxAuth auth, IMailTransportFactory transports, IEmailRenderer renderer,
    IUnsubscribeTokens unsubscribe, IPlatformSettings settings, IOutreachPolicy policy,
    INotificationDispatcher dispatcher, ICreditService credits, ILogger<OutreachEngine> logger) : IOutreachEngine
{
    private static readonly Random Jitter = new();
    private const int MaxAttempts = 3;
    /// <summary>Per pass, per mailbox. Spreads a day's sends out instead of firing them in one burst.</summary>
    private const int PerPassPerMailbox = 2;

    // ── Sending ──────────────────────────────────────────────────────────────────────────────

    public async Task SendDueAsync(Guid tenantId, CancellationToken ct)
    {
        var gate = await policy.CanSendAsync(ct);
        if (!gate.Ok) return;

        var cfg = await settings.GetAsync(ct);
        var now = DateTime.UtcNow; var today = now.Date;
        var campaigns = await db.Campaigns.Include(c => c.Steps).Where(c => !c.IsDeleted && c.Status == CampaignStatus.Active).ToListAsync(ct);
        if (campaigns.Count == 0) return;

        var sentToday = await db.Messages.CountAsync(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Sent && m.OccurredAt >= today, ct);
        var wsRemaining = cfg.MaxDailySendsPerWorkspace - sentToday;
        if (wsRemaining <= 0) return;

        var profile = await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var suppressed = await SuppressionSupport.LoadAsync(db, ct);

        foreach (var campaign in campaigns)
        {
            if (wsRemaining <= 0 || ct.IsCancellationRequested) break;

            var mailbox = await db.Mailboxes.FirstOrDefaultAsync(m => m.Id == campaign.MailboxId && !m.IsDeleted, ct);
            if (mailbox is null || mailbox.Status is MailboxStatus.Disconnected)
            {
                campaign.Pause("Its mailbox was disconnected.");
                await db.SaveChangesAsync(ct);
                continue;
            }
            if (!mailbox.CanSend) continue;   // errored or paused: leave the campaign as is until it is fixed
            if (!SendSchedule.IsOpen(now, campaign.TimeZoneId, campaign.WindowStart, campaign.WindowEnd, campaign.SendDays)) continue;

            var sentByCampaign = await db.Messages.CountAsync(m => m.CampaignId == campaign.Id && m.Direction == MessageDirection.Out
                && m.Status == MessageStatus.Sent && m.OccurredAt >= today, ct);
            var allowed = new[] { mailbox.RemainingToday(now, cfg.MaxDailySendsPerMailbox), wsRemaining, campaign.DailyCap - sentByCampaign, PerPassPerMailbox }.Min();
            if (allowed <= 0) continue;

            var due = await db.Recipients.Where(r => r.CampaignId == campaign.Id
                    && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active) && r.NextSendAt != null && r.NextSendAt <= now)
                .OrderBy(r => r.NextSendAt).Take(allowed).ToListAsync(ct);

            foreach (var r in due)
            {
                if (ct.IsCancellationRequested) return;

                // Claim first: if another pass already took this recipient, this matches nothing.
                var claimedUntil = now.AddMinutes(15); var was = r.NextSendAt;
                var claimed = await db.Recipients.Where(x => x.Id == r.Id && x.NextSendAt == was)
                    .ExecuteUpdateAsync(u => u.SetProperty(x => x.NextSendAt, claimedUntil), ct);
                if (claimed == 0) continue;

                var stop = await SendOneAsync(tenantId, campaign, mailbox, r, profile, suppressed, ct);
                wsRemaining--;
                if (stop) break;   // the mailbox itself is the problem; do not hammer it

                await Task.Delay(Jitter.Next(2000, 8000), ct);   // humans do not send in bursts
            }

            await CompleteIfFinishedAsync(campaign, ct);
        }
    }

    /// <summary>Returns true when sending from this mailbox should stop for now.</summary>
    private async Task<bool> SendOneAsync(Guid tenantId, Campaign campaign, Mailbox mailbox, CampaignRecipient r,
        LeadGenProfile? profile, HashSet<string> suppressed, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var prospect = await db.Prospects.FirstOrDefaultAsync(p => p.Id == r.ProspectId && !p.IsDeleted, ct);
        if (prospect is null) { r.Close(RecipientStatus.Skipped); await db.SaveChangesAsync(ct); return false; }

        if (SuppressionSupport.IsSuppressed(suppressed, r.Email, prospect.Domain, prospect.PhoneE164) || prospect.Status == ProspectStatus.DoNotContact)
        { r.Close(RecipientStatus.Unsubscribed); await db.SaveChangesAsync(ct); return false; }

        if (prospect.Status is ProspectStatus.Replied or ProspectStatus.Converted or ProspectStatus.Rejected or ProspectStatus.Qualified)
        { r.Close(RecipientStatus.Stopped); await db.SaveChangesAsync(ct); return false; }

        var step = campaign.Steps.FirstOrDefault(s => s.Number == r.CurrentStep + 1);
        if (step is null) { r.Close(RecipientStatus.Completed); await db.SaveChangesAsync(ct); return false; }

        var thread = r.ThreadId is { } tid ? await db.Threads.FirstOrDefaultAsync(t => t.Id == tid, ct) : null;
        var priorOut = thread is null ? [] : await db.Messages.AsNoTracking()
            .Where(m => m.ThreadId == thread.Id && m.Direction == MessageDirection.Out && m.Status == MessageStatus.Sent && m.MessageIdHeader != null)
            .OrderBy(m => m.OccurredAt).Select(m => new { m.MessageIdHeader, m.ProviderMessageId }).ToListAsync(ct);
        var last = priorOut.LastOrDefault();

        var unsubUrl = unsubscribe.UrlFor(tenantId, r.Email, campaign.Id);
        var rendered = renderer.Render(step.Subject, step.Body, prospect, profile, mailbox.DisplayName, unsubUrl);
        var subject = thread is null ? rendered.Subject : "Re: " + System.Text.RegularExpressions.Regex.Replace(thread.Subject, @"^(re:\s*)+", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var domain = mailbox.Address[(mailbox.Address.IndexOf('@') + 1)..];
        var messageId = $"<{Guid.NewGuid():N}@{domain}>";

        var mail = new OutgoingEmail(mailbox.Address, mailbox.DisplayName, r.Email, null, subject, rendered.Text, rendered.Html, messageId,
            last?.MessageIdHeader, priorOut.Select(p => p.MessageIdHeader!).TakeLast(10).ToList(),
            unsubUrl, thread?.ProviderThreadId, last?.ProviderMessageId);

        try
        {
            var creds = await auth.ResolveAsync(mailbox, ct);
            var sent = await transports.For(mailbox.Provider).SendAsync(creds, mail, ct);

            thread ??= AddThread(mailbox, r.Email, rendered.Subject, prospect.Id, campaign.Id);
            thread.SetProviderThread(sent.ProviderThreadId);
            var msg = new OutreachMessage(thread.Id, mailbox.Id, MessageDirection.Out, mailbox.Address, r.Email, subject);
            msg.SetContent(rendered.Text, null, sent.MessageIdHeader ?? messageId, last?.MessageIdHeader, null);
            msg.SetCampaign(campaign.Id, r.Id, step.Number);
            msg.MarkSent(sent.ProviderMessageId, sent.SentAt);
            db.Messages.Add(msg);
            thread.AddMessage(MessageDirection.Out, sent.SentAt, rendered.Text);

            mailbox.RecordSent(sent.SentAt);
            var next = campaign.Steps.FirstOrDefault(s => s.Number == step.Number + 1);
            var nextAt = next is null ? (DateTime?)null
                : SendSchedule.NextSlot(sent.SentAt.AddDays(next.DelayDays), campaign.TimeZoneId, campaign.WindowStart, campaign.WindowEnd, campaign.SendDays);
            r.RecordSent(thread.Id, step.Number, sent.SentAt, nextAt);
            if (prospect.Status is ProspectStatus.Revealed or ProspectStatus.Discovered) prospect.SetStatus(ProspectStatus.Contacted);
            await db.SaveChangesAsync(ct);
            return false;
        }
        catch (MailAuthException ex)
        {
            await FailMailboxAsync(tenantId, mailbox, ex.Message, ct);
            r.RecordFailure(ex.Message, now.AddMinutes(30), MaxAttempts + 100);   // not the recipient's fault; do not burn attempts
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (MailRejectedException ex)
        {
            // The server refused this recipient or this content. Retrying will not help.
            r.Close(RecipientStatus.Failed);
            r.RecordFailure(ex.Message, now, 1);
            await db.SaveChangesAsync(ct);
            return false;
        }
        catch (MailTransientException ex)
        {
            r.RecordFailure(ex.Message, now.AddMinutes(30), MaxAttempts);
            await db.SaveChangesAsync(ct);
            return false;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Unexpected failure sending campaign email to {Recipient}", r.Id);
            r.RecordFailure("Unexpected error.", now.AddMinutes(30), MaxAttempts);
            await db.SaveChangesAsync(ct);
            return false;
        }
    }

    private OutreachThread AddThread(Mailbox mailbox, string counterparty, string subject, Guid? prospectId, Guid? campaignId)
    {
        var t = new OutreachThread(mailbox.Id, counterparty, subject, prospectId, campaignId);
        db.Threads.Add(t);
        return t;
    }

    private async Task CompleteIfFinishedAsync(Campaign campaign, CancellationToken ct)
    {
        var open = await db.Recipients.AnyAsync(r => r.CampaignId == campaign.Id && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active), ct);
        if (open) return;
        if (!await db.Recipients.AnyAsync(r => r.CampaignId == campaign.Id, ct)) return;
        campaign.Complete();
        await db.SaveChangesAsync(ct);
    }

    private async Task FailMailboxAsync(Guid tenantId, Mailbox mailbox, string reason, CancellationToken ct)
    {
        mailbox.MarkError(reason);
        foreach (var c in await db.Campaigns.Where(c => c.MailboxId == mailbox.Id && c.Status == CampaignStatus.Active).ToListAsync(ct))
            c.Pause("Its mailbox needs to be reconnected.");
        await db.SaveChangesAsync(ct);
        await NotifyAsync(mailbox.OwnerUserId, tenantId, NotificationEvents.LeadGenMailboxProblem,
            "A mailbox needs your attention", $"{mailbox.Address}: {reason}", "/lead-generation/mailboxes", "warning", mailbox.Id, ct);
    }

    // ── Receiving ────────────────────────────────────────────────────────────────────────────

    public async Task<SyncOutcome> SyncMailboxAsync(Guid mailboxId, CancellationToken ct)
    {
        var mailbox = await db.Mailboxes.FirstOrDefaultAsync(m => m.Id == mailboxId && !m.IsDeleted, ct);
        if (mailbox is null || mailbox.Status is MailboxStatus.Disconnected) return new(0, 0, 0);
        var tenantId = TenantAmbient.TenantId ?? Guid.Empty;

        FetchResult result;
        try
        {
            var creds = await auth.ResolveAsync(mailbox, ct);
            result = await transports.For(mailbox.Provider).FetchAsync(creds, mailbox.SyncCursor, mailbox.LastSyncAt ?? mailbox.CreatedAt, ct);
        }
        catch (MailAuthException ex)
        {
            await FailMailboxAsync(tenantId, mailbox, ex.Message, ct);
            return new(0, 0, 0);
        }
        catch (MailTransientException ex)
        {
            mailbox.SetSyncCursor(mailbox.SyncCursor);   // still counts as an attempt
            await db.SaveChangesAsync(ct);
            logger.LogDebug(ex, "Mailbox {Mailbox} could not be read right now.", mailbox.Id);
            return new(0, 0, 0);
        }

        var cfg = await settings.GetAsync(ct);
        int replies = 0, bounces = 0, stored = 0;
        foreach (var m in result.Messages)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var kind = await ProcessIncomingAsync(tenantId, mailbox, m, cfg, ct);
                if (kind == IncomingKind.Reply) { replies++; stored++; }
                else if (kind == IncomingKind.Bounce) bounces++;
                else if (kind == IncomingKind.Stored) stored++;
            }
            catch (DbUpdateException ex)
            {
                // A duplicate (the same message seen twice) is expected and harmless.
                logger.LogDebug(ex, "Incoming message skipped.");
                db.ChangeTracker.Clear();
                mailbox = (await db.Mailboxes.FirstOrDefaultAsync(x => x.Id == mailboxId, ct))!;
            }
        }

        mailbox.SetSyncCursor(result.NewCursor);
        await db.SaveChangesAsync(ct);
        if (bounces > 0) await EvaluateHealthAsync(mailbox, ct);
        return new(result.Messages.Count, replies, bounces);
    }

    private enum IncomingKind { Ignored, Stored, Reply, Bounce }

    private async Task<IncomingKind> ProcessIncomingAsync(Guid tenantId, Mailbox mailbox, IncomingEmail m, PlatformSettings cfg, CancellationToken ct)
    {
        if (await db.Messages.AnyAsync(x => x.MailboxId == mailbox.Id && x.ProviderMessageId == m.ProviderMessageId, ct)) return IncomingKind.Ignored;

        if (m.IsBounce) { await HandleBounceAsync(tenantId, mailbox, m, cfg, ct); return IncomingKind.Bounce; }

        var thread = await FindThreadAsync(mailbox, m, ct);
        if (thread is null) return IncomingKind.Ignored;   // not part of any outreach conversation: leave it in their own mailbox

        var classification = ReplyClassifier.Classify(m.Subject, m.BodyText, m.IsAutoReply);
        var msg = new OutreachMessage(thread.Id, mailbox.Id, MessageDirection.In, m.From, mailbox.Address, string.IsNullOrWhiteSpace(m.Subject) ? thread.Subject : m.Subject);
        msg.SetContent(m.BodyText, null, m.MessageId, m.InReplyTo, m.Cc);
        msg.MarkReceived(m.ProviderMessageId, m.ReceivedAt);
        if (m.IsAutoReply) msg.SetRead(true);   // an out-of-office is not worth a notification
        db.Messages.Add(msg);

        thread.SetProviderThread(m.ProviderThreadId);
        thread.AddMessage(MessageDirection.In, m.ReceivedAt, ReplyClassifier.NewText(m.BodyText));
        if (m.IsAutoReply) thread.MarkRead(); else thread.Classify(classification);

        var prospect = thread.ProspectId is { } pid ? await db.Prospects.FirstOrDefaultAsync(p => p.Id == pid, ct) : null;
        var recipients = await db.Recipients.Where(r => r.ThreadId == thread.Id).ToListAsync(ct);

        if (m.IsAutoReply)
        {
            // Out of office: keep the campaign going — they will be back.
            await db.SaveChangesAsync(ct);
            return IncomingKind.Stored;
        }

        if (classification == ThreadClass.Unsubscribe)
        {
            await SuppressionSupport.AddAsync(db, SuppressionKind.Email, m.From, SuppressionReason.Unsubscribed, "reply", null, alsoGlobal: true, ct);
            await ClosePeopleAsync(m.From, RecipientStatus.Unsubscribed, ct);
            if (prospect is not null) prospect.SetStatus(ProspectStatus.DoNotContact);
            thread.MarkRead();
            await db.SaveChangesAsync(ct);
            return IncomingKind.Stored;
        }

        // A real reply. Stop the sequence — nobody wants a "just following up" after they answered.
        var campaign = thread.CampaignId is { } cid ? await db.Campaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Id == cid, ct) : null;
        if (campaign?.StopOnReply != false)
            foreach (var r in recipients.Where(r => RecipientStatus.IsOpen(r.Status) || r.Status == RecipientStatus.Completed)) r.Close(RecipientStatus.Replied);
        if (prospect is not null && prospect.Status is ProspectStatus.Contacted or ProspectStatus.Revealed or ProspectStatus.Discovered)
            prospect.SetStatus(classification == ThreadClass.NotInterested ? ProspectStatus.Rejected : ProspectStatus.Replied);
        mailbox.RecordReply();
        await db.SaveChangesAsync(ct);

        var who = thread.AssignedUserId ?? prospect?.OwnerUserId ?? campaign?.CreatedByUserId ?? mailbox.OwnerUserId;
        await NotifyAsync(who, tenantId, NotificationEvents.LeadGenReply,
            $"{prospect?.Name ?? m.FromName ?? m.From} replied",
            ReplyClassifier.NewText(m.BodyText) is { Length: > 0 } nt ? (nt.Length > 140 ? nt[..140] + "…" : nt) : "Open the inbox to read it.",
            $"/lead-generation/inbox?thread={thread.Id}", classification == ThreadClass.Interested ? "success" : "info", thread.Id, ct);
        return IncomingKind.Reply;
    }

    private async Task<OutreachThread?> FindThreadAsync(Mailbox mailbox, IncomingEmail m, CancellationToken ct)
    {
        // 1) The reply names one of our messages.
        var refs = m.References.Concat(m.InReplyTo is null ? [] : [m.InReplyTo]).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
        if (refs.Count > 0)
        {
            var tid = await db.Messages.AsNoTracking().Where(x => x.MailboxId == mailbox.Id && x.Direction == MessageDirection.Out && x.MessageIdHeader != null && refs.Contains(x.MessageIdHeader!))
                .Select(x => (Guid?)x.ThreadId).FirstOrDefaultAsync(ct);
            if (tid is { } id) return await db.Threads.FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted, ct);
        }
        // 2) The provider's own conversation id.
        if (!string.IsNullOrEmpty(m.ProviderThreadId))
        {
            var t = await db.Threads.FirstOrDefaultAsync(x => x.MailboxId == mailbox.Id && x.ProviderThreadId == m.ProviderThreadId && !x.IsDeleted, ct);
            if (t is not null) return t;
        }
        // 3) Someone we emailed writes back with a matching subject, without threading headers.
        var since = DateTime.UtcNow.AddDays(-30);
        var subject = System.Text.RegularExpressions.Regex.Replace(m.Subject ?? "", @"^((re|fw|fwd):\s*)+", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
        return await db.Threads.FirstOrDefaultAsync(t => t.MailboxId == mailbox.Id && !t.IsDeleted && t.Counterparty == m.From
            && t.LastMessageAt >= since && t.Subject == subject, ct);
    }

    private async Task ClosePeopleAsync(string email, string status, CancellationToken ct)
    {
        var e = email.ToLowerInvariant();
        foreach (var r in await db.Recipients.Where(r => r.Email == e && (r.Status == RecipientStatus.Pending || r.Status == RecipientStatus.Active || r.Status == RecipientStatus.Completed)).ToListAsync(ct))
            r.Close(status);
        foreach (var p in await db.Prospects.Where(p => !p.IsDeleted && p.Email == e).ToListAsync(ct)) p.SetStatus(ProspectStatus.DoNotContact);
    }

    // ── Bounces ──────────────────────────────────────────────────────────────────────────────

    private async Task HandleBounceAsync(Guid tenantId, Mailbox mailbox, IncomingEmail m, PlatformSettings cfg, CancellationToken ct)
    {
        var rcpt = m.BounceRecipient?.ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(rcpt)) return;

        // The address does not exist. Never write to it again — from this workspace or any other.
        await SuppressionSupport.AddAsync(db, SuppressionKind.Email, rcpt, SuppressionReason.Bounced, "bounce", null, alsoGlobal: true, ct);
        mailbox.RecordBounce();

        foreach (var r in await db.Recipients.Where(r => r.Email == rcpt && r.Status != RecipientStatus.Bounced).ToListAsync(ct)) r.Close(RecipientStatus.Bounced);

        var lastOut = await db.Messages.Where(x => x.MailboxId == mailbox.Id && x.Direction == MessageDirection.Out && x.ToAddress == rcpt && x.Status == MessageStatus.Sent)
            .OrderByDescending(x => x.OccurredAt).FirstOrDefaultAsync(ct);
        lastOut?.MarkBounced(m.BounceReason);

        var prospects = await db.Prospects.Where(p => !p.IsDeleted && p.Email == rcpt).ToListAsync(ct);
        foreach (var p in prospects)
        {
            p.SetContactEmail(rcpt, EmailStatus.Invalid, p.EmailIsRole);
            var profile = ProspectSupport.ProfileFor(await db.Profiles.AsNoTracking().FirstOrDefaultAsync(ct));
            var s = ProspectSupport.ScoreOf(p, profile);
            p.SetScores(s.Quality, s.Fit, Application.Scoring.ProspectScoring.NotesJson(s.Notes));

            if (p.DirectoryId is { } did && await db.Directory.FirstOrDefaultAsync(d => d.Id == did, ct) is { } dir && string.Equals(dir.Email, rcpt, StringComparison.OrdinalIgnoreCase))
                dir.InvalidateEmail();

            // "Only pay for leads that work": a reveal whose email bounced soon after is credited back.
            var withinWindow = p.RevealedAt is { } at && at >= DateTime.UtcNow.AddDays(-cfg.BounceRefundDays);
            if (withinWindow && p.CreditsCharged > 0)
            {
                var bonus = Math.Min(cfg.VerifiedEmailBonus, Math.Max(0, p.CreditsCharged - cfg.RevealCost));
                var refund = bonus + (string.IsNullOrWhiteSpace(p.PhoneE164) ? Math.Min(cfg.RevealCost, p.CreditsCharged - bonus) : 0);
                if (refund > 0)
                {
                    var res = await credits.AddAsync(refund, LedgerType.Refund, $"Email bounced for {p.Name}", "prospect", p.Id, $"bounce-refund:{p.Id}", ct);
                    if (res.Ok && !res.AlreadyDone) p.ReduceCharge(refund);
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }

    // ── Health ───────────────────────────────────────────────────────────────────────────────

    public async Task EvaluateHealthAsync(Mailbox mailbox, CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        if (mailbox.TotalSent < 50 || mailbox.Status != MailboxStatus.Connected) return;

        var bounceBp = mailbox.TotalBounced * 10_000L / mailbox.TotalSent;
        var complaintBp = mailbox.TotalComplaints * 10_000L / mailbox.TotalSent;
        if (bounceBp <= cfg.BounceRatePauseBp && complaintBp <= cfg.ComplaintRatePauseBp) return;

        var reason = bounceBp > cfg.BounceRatePauseBp
            ? $"Paused automatically: {bounceBp / 100.0:0.#}% of emails bounced. Clean your list before sending more."
            : $"Paused automatically: {complaintBp / 100.0:0.##}% of recipients complained.";
        mailbox.Pause(reason);
        foreach (var c in await db.Campaigns.Where(c => c.MailboxId == mailbox.Id && c.Status == CampaignStatus.Active).ToListAsync(ct))
            c.Pause("Its mailbox was paused for sending quality.");
        await db.SaveChangesAsync(ct);

        var tenantId = TenantAmbient.TenantId ?? Guid.Empty;
        await NotifyAsync(mailbox.OwnerUserId, tenantId, NotificationEvents.LeadGenMailboxProblem,
            "Sending paused to protect your reputation", $"{mailbox.Address}: {reason}", "/lead-generation/mailboxes", "warning", mailbox.Id, ct);
    }

    // ── Replying from the inbox ──────────────────────────────────────────────────────────────

    public async Task<OutreachMessage> SendReplyAsync(OutreachThread thread, Mailbox mailbox, string text, CancellationToken ct)
    {
        var prior = await db.Messages.AsNoTracking().Where(m => m.ThreadId == thread.Id && m.MessageIdHeader != null && m.Status != MessageStatus.Failed)
            .OrderBy(m => m.OccurredAt).Select(m => new { m.MessageIdHeader, m.ProviderMessageId, m.Direction }).ToListAsync(ct);
        var last = prior.LastOrDefault();
        var lastOut = prior.LastOrDefault(p => p.Direction == MessageDirection.Out);

        var subject = "Re: " + System.Text.RegularExpressions.Regex.Replace(thread.Subject, @"^(re:\s*)+", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var domain = mailbox.Address[(mailbox.Address.IndexOf('@') + 1)..];
        var messageId = $"<{Guid.NewGuid():N}@{domain}>";
        var mail = new OutgoingEmail(mailbox.Address, mailbox.DisplayName, thread.Counterparty, null, subject, text.Trim(),
            EmailRenderer.ReplyHtml(text), messageId, last?.MessageIdHeader, prior.Select(p => p.MessageIdHeader!).TakeLast(10).ToList(),
            null, thread.ProviderThreadId, (last ?? lastOut)?.ProviderMessageId);

        var creds = await auth.ResolveAsync(mailbox, ct);
        var sent = await transports.For(mailbox.Provider).SendAsync(creds, mail, ct);

        var msg = new OutreachMessage(thread.Id, mailbox.Id, MessageDirection.Out, mailbox.Address, thread.Counterparty, subject);
        msg.SetContent(text.Trim(), null, sent.MessageIdHeader ?? messageId, last?.MessageIdHeader, null);
        msg.MarkSent(sent.ProviderMessageId, sent.SentAt);
        msg.SetRead(true);
        db.Messages.Add(msg);
        thread.AddMessage(MessageDirection.Out, sent.SentAt, text);
        thread.MarkRead();
        thread.SetProviderThread(sent.ProviderThreadId);
        mailbox.RecordSent(sent.SentAt);
        await db.SaveChangesAsync(ct);
        return msg;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────

    private async Task NotifyAsync(Guid? user, Guid tenantId, string evt, string title, string message, string link, string type, Guid relatedId, CancellationToken ct)
    {
        if (user is not { } u || tenantId == Guid.Empty) return;
        try
        {
            await dispatcher.PublishAsync(new NotificationRequest(u, NotificationModules.LeadGen, evt, title, message,
                Link: link, Type: type, RelatedToType: "leadgen", RelatedToId: relatedId, TenantId: tenantId), ct);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Lead generation notification failed."); }
    }
}
