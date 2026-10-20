using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application.Reports;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Reports;

/// <summary>
/// The one-screen answer to "is this working?": how far prospects get, what sending is producing,
/// what it cost, and what needs the user's attention right now.
/// </summary>
internal sealed class GetDashboardHandler(LeadGenDbContext db, ICreditService credits, IOutreachPolicy policy)
    : IQueryHandler<GetDashboardQuery, DashboardDto>
{
    public async Task<Result<DashboardDto>> Handle(GetDashboardQuery q, CancellationToken ct)
    {
        var days = Math.Clamp(q.Days, 7, 180);
        var since = DateTime.UtcNow.Date.AddDays(-(days - 1));
        var wallet = await credits.EnsureWalletAsync(ct);

        // ── Funnel (all time, since a prospect's journey is not bounded by a date range) ──
        var prospects = db.Prospects.AsNoTracking().Where(p => !p.IsDeleted);
        var by = await prospects.GroupBy(p => p.Status).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        int S(string s) => by.GetValueOrDefault(s);
        var revealedTotal = await prospects.CountAsync(p => p.IsRevealed, ct);
        var contacted = S(ProspectStatus.Contacted) + S(ProspectStatus.Replied) + S(ProspectStatus.Qualified) + S(ProspectStatus.Converted) + S(ProspectStatus.Rejected);
        var funnel = new FunnelDto(by.Values.Sum(), revealedTotal, contacted,
            S(ProspectStatus.Replied) + S(ProspectStatus.Qualified) + S(ProspectStatus.Converted),
            S(ProspectStatus.Qualified) + S(ProspectStatus.Converted), S(ProspectStatus.Converted));

        // ── Sending, in the window ──
        var msgs = db.Messages.AsNoTracking().Where(m => !m.IsDeleted && m.OccurredAt >= since);
        var sent = await msgs.CountAsync(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Sent, ct);
        var bounces = await msgs.CountAsync(m => m.Direction == MessageDirection.Out && m.Status == MessageStatus.Bounced, ct);
        var replies = await db.Threads.AsNoTracking().CountAsync(t => !t.IsDeleted && t.HasReply && t.LastMessageAt >= since && t.Classification != ThreadClass.OutOfOffice, ct);
        var interested = await db.Threads.AsNoTracking().CountAsync(t => !t.IsDeleted && t.Classification == ThreadClass.Interested && t.LastMessageAt >= since, ct);
        double Pct(int a, int b) => b == 0 ? 0 : Math.Round(a * 100.0 / b, 1);

        var perDay = await msgs.Where(m => m.Direction == MessageDirection.Out || m.Status == MessageStatus.Received)
            .GroupBy(m => new { Day = m.OccurredAt.Date, m.Direction, m.Status })
            .Select(g => new { g.Key.Day, g.Key.Direction, g.Key.Status, N = g.Count() }).ToListAsync(ct);
        var series = Enumerable.Range(0, days).Select(i =>
        {
            var d = since.AddDays(i);
            return new DayPointDto(d.ToString("yyyy-MM-dd"),
                perDay.Where(x => x.Day == d && x.Direction == MessageDirection.Out && x.Status == MessageStatus.Sent).Sum(x => x.N),
                perDay.Where(x => x.Day == d && x.Direction == MessageDirection.In).Sum(x => x.N),
                perDay.Where(x => x.Day == d && x.Status == MessageStatus.Bounced).Sum(x => x.N));
        }).ToList();

        // ── Money ──
        var ledger = await db.Ledger.AsNoTracking().Where(l => l.CreatedAt >= since).GroupBy(l => l.Type)
            .Select(g => new { g.Key, Sum = g.Sum(x => x.Amount) }).ToDictionaryAsync(x => x.Key, x => x.Sum, ct);
        var spent = -ledger.GetValueOrDefault(LedgerType.Spend); var refunded = ledger.GetValueOrDefault(LedgerType.Refund);

        // ── Campaigns ──
        var campaignRows = await db.Campaigns.AsNoTracking().Where(c => !c.IsDeleted).OrderByDescending(c => c.CreatedAt).Take(8).ToListAsync(ct);
        var cIds = campaignRows.Select(c => c.Id).ToList();
        var recStats = await db.Recipients.AsNoTracking().Where(r => cIds.Contains(r.CampaignId)).GroupBy(r => r.CampaignId)
            .Select(g => new { g.Key, Total = g.Count(), Contacted = g.Count(r => r.CurrentStep > 0), Replied = g.Count(r => r.Status == RecipientStatus.Replied), Bounced = g.Count(r => r.Status == RecipientStatus.Bounced) })
            .ToDictionaryAsync(x => x.Key, ct);
        var sentBy = await db.Messages.AsNoTracking().Where(m => m.CampaignId != null && cIds.Contains(m.CampaignId!.Value) && m.Direction == MessageDirection.Out && m.Status != MessageStatus.Failed && m.Status != MessageStatus.Queued)
            .GroupBy(m => m.CampaignId!.Value).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var interestedBy = await db.Threads.AsNoTracking().Where(t => t.CampaignId != null && cIds.Contains(t.CampaignId!.Value) && t.Classification == ThreadClass.Interested)
            .GroupBy(t => t.CampaignId!.Value).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var campaigns = campaignRows.Select(c =>
        {
            recStats.TryGetValue(c.Id, out var s);
            return new CampaignRowDto(c.Id, c.Name, c.Status, s?.Total ?? 0, sentBy.GetValueOrDefault(c.Id), s?.Replied ?? 0,
                Pct(s?.Replied ?? 0, s?.Contacted ?? 0), s?.Bounced ?? 0, interestedBy.GetValueOrDefault(c.Id));
        }).ToList();

        // ── Which searches paid off ──
        var jobs = await db.Searches.AsNoTracking().Where(s => !s.IsDeleted && s.Status == SearchStatus.Completed).OrderByDescending(s => s.CreatedAt).Take(8).ToListAsync(ct);
        var jIds = jobs.Select(j => j.Id).ToList();
        var jStats = await db.Prospects.AsNoTracking().Where(p => !p.IsDeleted && p.SearchJobId != null && jIds.Contains(p.SearchJobId!.Value))
            .GroupBy(p => p.SearchJobId!.Value).Select(g => new
            {
                g.Key, Revealed = g.Count(p => p.IsRevealed), Spent = g.Sum(p => p.CreditsCharged),
                Replied = g.Count(p => p.Status == ProspectStatus.Replied || p.Status == ProspectStatus.Qualified || p.Status == ProspectStatus.Converted),
                Converted = g.Count(p => p.Status == ProspectStatus.Converted),
            }).ToDictionaryAsync(x => x.Key, ct);
        var sources = jobs.Select(j =>
        {
            jStats.TryGetValue(j.Id, out var s);
            return new SourceRowDto(j.Id, j.Name, j.FoundCount, s?.Revealed ?? 0, s?.Replied ?? 0, s?.Converted ?? 0, s?.Spent ?? 0,
                (s?.Replied ?? 0) == 0 ? 0 : Math.Round((double)(s?.Spent ?? 0) / s!.Replied, 1));
        }).ToList();

        // ── What needs attention ──
        var mailboxes = await db.Mailboxes.AsNoTracking().Where(m => !m.IsDeleted).ToListAsync(ct);
        var unread = await db.Threads.AsNoTracking().CountAsync(t => !t.IsDeleted && !t.IsArchived && t.UnreadCount > 0 && t.HasReply, ct);
        var attention = new List<string>();
        if (unread > 0) attention.Add($"{unread} {(unread == 1 ? "reply is" : "replies are")} waiting in your inbox.");
        foreach (var m in mailboxes.Where(m => m.Status == MailboxStatus.Error)) attention.Add($"{m.Address} needs to be reconnected.");
        foreach (var m in mailboxes.Where(m => m.Status == MailboxStatus.Paused && m.StatusReason?.StartsWith("Paused automatically") == true)) attention.Add($"{m.Address} was paused to protect your sending reputation.");
        var pausedCampaigns = await db.Campaigns.AsNoTracking().CountAsync(c => !c.IsDeleted && c.Status == CampaignStatus.Paused && c.PauseReason != "Paused by you.", ct);
        if (pausedCampaigns > 0) attention.Add($"{pausedCampaigns} campaign{(pausedCampaigns == 1 ? " was" : "s were")} paused automatically.");
        if (wallet.LowBalanceAlert is { } low && wallet.Balance <= low) attention.Add($"Only {wallet.Balance} credits left.");
        else if (wallet.Balance < 5) attention.Add($"Only {wallet.Balance} credits left.");
        var gate = await policy.CanSendAsync(ct);
        if (!gate.Ok && gate.Reason is not null) attention.Add(gate.Reason);

        return Result.Success(new DashboardDto(
            wallet.Balance, days, funnel, sent, replies, bounces, interested, Pct(replies, sent), Pct(bounces, sent),
            spent, refunded, await db.Campaigns.AsNoTracking().CountAsync(c => !c.IsDeleted && c.Status == CampaignStatus.Active, ct),
            unread, mailboxes.Count(m => m.Status == MailboxStatus.Connected), mailboxes.Count(m => m.Status == MailboxStatus.Paused),
            series, campaigns, sources, attention));
    }
}
