using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Dashboard;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Application.Reports;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

internal sealed class GetFitnessDashboardHandler(FitnessDbContext db) : IQueryHandler<GetFitnessDashboardQuery, FitnessDashboardDto>
{
    public async Task<Result<FitnessDashboardDto>> Handle(GetFitnessDashboardQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var settings = await Fx.SettingsAsync(db, ct);
        var monthStart = today[..8] + "01";
        var branch = q.BranchId;

        var members = db.Members.AsNoTracking().Where(m => !m.IsDeleted);
        if (branch is { } bm) members = members.Where(m => m.HomeBranchId == bm);
        var memberList = await members.Select(m => new { m.Id, m.FirstName, m.LastName, m.MemberNumber, m.Phone, m.JoinedOn, m.Status }).ToListAsync(ct);
        var ids = memberList.Select(m => m.Id).ToList();

        var subs = (await db.Subscriptions.AsNoTracking().Where(s => !s.IsDeleted && ids.Contains(s.MemberId)).ToListAsync(ct))
            .GroupBy(s => s.MemberId).ToDictionary(g => g.Key, g => g.ToList());

        int active = 0, expiringSoon = 0, expiredRecent = 0, frozen = 0;
        var byPlan = new Dictionary<string, int>();
        var expiring = new List<ExpiringMemberDto>();
        var cutoffExpired = Fx.Add(today, -30);
        foreach (var m in memberList)
        {
            var mine = subs.GetValueOrDefault(m.Id) ?? [];
            var cur = Fx.Current(mine, today);
            if (cur is null) continue;
            var st = Fx.State(cur, today);
            if (st == "frozen") { frozen++; active++; byPlan[cur.PlanName] = byPlan.GetValueOrDefault(cur.PlanName) + 1; }
            else if (st == "active")
            {
                active++;
                byPlan[cur.PlanName] = byPlan.GetValueOrDefault(cur.PlanName) + 1;
                var left = Fx.DaysBetween(today, cur.EndDate);
                if (left <= settings.ExpiringWithinDays)
                {
                    expiringSoon++;
                    expiring.Add(new ExpiringMemberDto(m.Id, string.IsNullOrEmpty(m.LastName) ? m.FirstName : $"{m.FirstName} {m.LastName}",
                        m.MemberNumber, m.Phone, cur.PlanName, cur.EndDate, left));
                }
            }
            else if (st == "expired" && string.CompareOrdinal(cur.EndDate, cutoffExpired) >= 0) expiredRecent++;
        }

        // Retention: of memberships that ended in the last 90 days, how many members took another one afterwards.
        var windowStart = Fx.Add(today, -90);
        var ended = 0; var renewed = 0;
        foreach (var kv in subs)
            foreach (var s in kv.Value.Where(s => s.Status != SubscriptionStatus.Cancelled && string.CompareOrdinal(s.EndDate, windowStart) >= 0 && string.CompareOrdinal(s.EndDate, today) < 0))
            {
                ended++;
                if (kv.Value.Any(o => o.Id != s.Id && o.Status != SubscriptionStatus.Cancelled && string.CompareOrdinal(o.StartDate, s.EndDate) > 0)) renewed++;
            }

        var checkIns = db.CheckIns.AsNoTracking().Where(c => c.Allowed);
        var pays = db.Payments.AsNoTracking().Where(p => !p.IsVoided);
        var sessions = db.Sessions.AsNoTracking().Where(s => !s.IsDeleted && s.Date == today && s.Status != SessionStatus.Cancelled);
        var ptToday = db.PtSessions.AsNoTracking().Where(s => s.Date == today && s.Status != PtSessionStatus.Cancelled);
        if (branch is { } b)
        {
            checkIns = checkIns.Where(c => c.BranchId == b);
            pays = pays.Where(p => p.BranchId == b);
            sessions = sessions.Where(s => s.BranchId == b);
            ptToday = ptToday.Where(s => s.BranchId == b);
        }

        var inGym = await DeskRules.InGym(db, today).Where(c => branch == null || c.BranchId == branch).CountAsync(ct);
        var visitsToday = await checkIns.CountAsync(c => c.Date == today, ct);
        var sessionIds = await sessions.Select(s => s.Id).ToListAsync(ct);
        var bookingsToday = await db.Bookings.CountAsync(b2 => sessionIds.Contains(b2.SessionId)
            && (b2.Status == BookingStatus.Booked || b2.Status == BookingStatus.Attended), ct);

        var revenueToday = await pays.Where(p => p.PaidOn == today).SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var revenueMonth = await pays.Where(p => string.Compare(p.PaidOn, monthStart) >= 0 && string.Compare(p.PaidOn, today) <= 0).SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var outstanding = (await Fx.BalancesAsync(db, ids, ct)).Values.Sum();

        var leads = db.Leads.AsNoTracking().Where(l => !l.IsDeleted && l.Status != LeadStatus.Converted && l.Status != LeadStatus.Lost);
        if (branch is { } lb) leads = leads.Where(l => l.BranchId == lb);
        var openLeads = await leads.CountAsync(ct);
        var followUp = await leads.CountAsync(l => l.FollowUpOn != null && string.Compare(l.FollowUpOn, today) <= 0, ct);

        var equipment = db.Equipment.AsNoTracking().Where(e => !e.IsDeleted && e.Status != EquipmentStatus.Retired);
        if (branch is { } eb) equipment = equipment.Where(e => e.BranchId == eb);
        var equipmentDue = await equipment.CountAsync(e => e.Status == EquipmentStatus.NeedsService || e.Status == EquipmentStatus.OutOfOrder
            || (e.NextServiceOn != null && string.Compare(e.NextServiceOn, today) <= 0), ct);

        // Last 14 days: visits and money per day, zero-filled so the chart has no gaps.
        var from14 = Fx.Add(today, -13);
        var visitDays = await checkIns.Where(c => string.Compare(c.Date, from14) >= 0 && string.Compare(c.Date, today) <= 0)
            .GroupBy(c => c.Date).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var payDays = await pays.Where(p => string.Compare(p.PaidOn, from14) >= 0 && string.Compare(p.PaidOn, today) <= 0)
            .GroupBy(p => p.PaidOn).Select(g => new { g.Key, Sum = g.Sum(p => p.Amount) }).ToDictionaryAsync(x => x.Key, x => x.Sum, ct);
        var days = Enumerable.Range(0, 14).Select(i => Fx.Add(from14, i))
            .Select(d => new DayFigure(d, visitDays.GetValueOrDefault(d), payDays.GetValueOrDefault(d))).ToList();

        var since = DateTime.UtcNow.AddDays(-30);
        var hours = (await checkIns.Where(c => c.CheckedInAt >= since).Select(c => c.CheckedInAt).ToListAsync(ct))
            .GroupBy(t => t.Hour).OrderByDescending(g => g.Count()).Take(6).OrderBy(g => g.Key)
            .Select(g => new NameCount($"{g.Key:D2}:00", g.Count())).ToList();

        return Result.Success(new FitnessDashboardDto(active, memberList.Count, memberList.Count(m => string.CompareOrdinal(m.JoinedOn, monthStart) >= 0),
            expiringSoon, expiredRecent, frozen, inGym, visitsToday, sessionIds.Count, bookingsToday, await ptToday.CountAsync(ct),
            revenueToday, revenueMonth, outstanding, openLeads, followUp, equipmentDue,
            ended == 0 ? 0m : Math.Round(100m * renewed / ended, 1), days,
            byPlan.OrderByDescending(x => x.Value).Take(8).Select(x => new NameCount(x.Key, x.Value)).ToList(), hours,
            expiring.OrderBy(e => e.DaysLeft).Take(10).ToList()));
    }
}

/// <summary>Reports for the Reports hub: flat rows, each tied to the date it is filtered on.</summary>
internal sealed class RunFitnessReportHandler(FitnessDbContext db) : IQueryHandler<RunFitnessReportQuery, FitnessReportResult>
{
    private const int Cap = 5000;

    public async Task<Result<FitnessReportResult>> Handle(RunFitnessReportQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var to = Dates.Valid(q.To) ? q.To! : today;
        var from = Dates.Valid(q.From) ? q.From! : Fx.Add(to, -29);
        var id = q.ReportId.StartsWith("fitness-") ? q.ReportId["fitness-".Length..] : q.ReportId;
        var branches = await Fx.BranchNamesAsync(db, ct);
        string Br(Guid? b) => b is { } x ? branches.GetValueOrDefault(x) ?? "" : "";

        List<Dictionary<string, object?>> rows;
        switch (id)
        {
            case "payments":
            {
                var p = db.Payments.AsNoTracking().Where(x => !x.IsVoided && string.Compare(x.PaidOn, from) >= 0 && string.Compare(x.PaidOn, to) <= 0);
                if (q.BranchId is { } b) p = p.Where(x => x.BranchId == b);
                var list = await p.OrderBy(x => x.PaidOn).Take(Cap).ToListAsync(ct);
                var mIds = list.Select(x => x.MemberId).Distinct().ToList();
                var names = await db.Members.AsNoTracking().IgnoreQueryFilters().Where(m => mIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, m => m.FirstName + (m.LastName == null ? "" : " " + m.LastName), ct);
                rows = list.Select(x => new Dictionary<string, object?> { ["Date"] = x.PaidOn, ["Receipt"] = x.ReceiptNumber,
                    ["Member"] = names.GetValueOrDefault(x.MemberId), ["Amount"] = x.Amount, ["Method"] = x.Method, ["Branch"] = Br(x.BranchId),
                    ["Received by"] = x.ReceivedByName }).ToList();
                break;
            }
            case "revenue-by-method":
            {
                var p = db.Payments.AsNoTracking().Where(x => !x.IsVoided && string.Compare(x.PaidOn, from) >= 0 && string.Compare(x.PaidOn, to) <= 0);
                if (q.BranchId is { } b) p = p.Where(x => x.BranchId == b);
                rows = (await p.GroupBy(x => x.Method).Select(g => new { g.Key, N = g.Count(), Sum = g.Sum(x => x.Amount) }).ToListAsync(ct))
                    .OrderByDescending(x => x.Sum).Select(x => new Dictionary<string, object?> { ["Method"] = x.Key, ["Payments"] = x.N, ["Total"] = x.Sum }).ToList();
                break;
            }
            case "memberships-sold":
            {
                var s = db.Subscriptions.AsNoTracking().Where(x => !x.IsDeleted && x.Status != SubscriptionStatus.Cancelled && string.Compare(x.StartDate, from) >= 0 && string.Compare(x.StartDate, to) <= 0);
                if (q.BranchId is { } b) s = s.Where(x => x.BranchId == b);
                rows = (await s.GroupBy(x => x.PlanName).Select(g => new { g.Key, N = g.Count(), Sum = g.Sum(x => x.Price - x.Discount + x.JoiningFee), Paid = g.Sum(x => x.AmountPaid) }).ToListAsync(ct))
                    .OrderByDescending(x => x.N).Select(x => new Dictionary<string, object?> { ["Plan"] = x.Key, ["Sold"] = x.N, ["Value"] = x.Sum, ["Collected"] = x.Paid }).ToList();
                break;
            }
            case "expiring":
            {
                var list = await db.Subscriptions.AsNoTracking().Where(x => !x.IsDeleted && x.Status == SubscriptionStatus.Active
                    && string.Compare(x.EndDate, from) >= 0 && string.Compare(x.EndDate, to) <= 0).OrderBy(x => x.EndDate).Take(Cap).ToListAsync(ct);
                var mIds = list.Select(x => x.MemberId).Distinct().ToList();
                var ms = await db.Members.AsNoTracking().Where(m => mIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);
                rows = list.Where(x => ms.ContainsKey(x.MemberId) && (q.BranchId == null || ms[x.MemberId].HomeBranchId == q.BranchId))
                    .Select(x => new Dictionary<string, object?> { ["Ends"] = x.EndDate, ["Member"] = ms[x.MemberId].FullName, ["Number"] = ms[x.MemberId].MemberNumber,
                        ["Phone"] = ms[x.MemberId].Phone, ["Plan"] = x.PlanName, ["Balance"] = x.Balance }).ToList();
                break;
            }
            case "outstanding":
            {
                var balances = await Fx.BalancesAsync(db, null, ct);
                var ids = balances.Where(kv => kv.Value > 0).Select(kv => kv.Key).ToList();
                var ms = await db.Members.AsNoTracking().Where(m => ids.Contains(m.Id)).ToListAsync(ct);
                rows = ms.Where(m => q.BranchId == null || m.HomeBranchId == q.BranchId).OrderByDescending(m => balances[m.Id])
                    .Select(m => new Dictionary<string, object?> { ["Member"] = m.FullName, ["Number"] = m.MemberNumber, ["Phone"] = m.Phone, ["Branch"] = Br(m.HomeBranchId), ["Balance"] = balances[m.Id] }).ToList();
                break;
            }
            case "attendance":
            {
                var c = db.CheckIns.AsNoTracking().Where(x => x.Allowed && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0);
                if (q.BranchId is { } b) c = c.Where(x => x.BranchId == b);
                rows = (await c.GroupBy(x => x.Date).Select(g => new { g.Key, N = g.Count(), U = g.Select(x => x.MemberId).Distinct().Count() }).ToListAsync(ct))
                    .OrderBy(x => x.Key).Select(x => new Dictionary<string, object?> { ["Date"] = x.Key, ["Visits"] = x.N, ["Different members"] = x.U }).ToList();
                break;
            }
            case "class-attendance":
            {
                var s = db.Sessions.AsNoTracking().Where(x => !x.IsDeleted && x.Status != SessionStatus.Cancelled && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0);
                if (q.BranchId is { } b) s = s.Where(x => x.BranchId == b);
                var list = await s.OrderBy(x => x.Date).Take(Cap).ToListAsync(ct);
                var sIds = list.Select(x => x.Id).ToList();
                var counts = (await db.Bookings.AsNoTracking().Where(x => sIds.Contains(x.SessionId)).GroupBy(x => new { x.SessionId, x.Status })
                    .Select(g => new { g.Key.SessionId, g.Key.Status, N = g.Count() }).ToListAsync(ct)).ToLookup(x => x.SessionId);
                rows = list.Select(x => new Dictionary<string, object?> { ["Date"] = x.Date, ["Time"] = x.StartTime, ["Class"] = x.ClassName, ["Capacity"] = x.Capacity,
                    ["Booked"] = counts[x.Id].Where(c => c.Status is BookingStatus.Booked or BookingStatus.Attended or BookingStatus.NoShow).Sum(c => c.N),
                    ["Attended"] = counts[x.Id].Where(c => c.Status == BookingStatus.Attended).Sum(c => c.N),
                    ["No-shows"] = counts[x.Id].Where(c => c.Status == BookingStatus.NoShow).Sum(c => c.N), ["Branch"] = Br(x.BranchId) }).ToList();
                break;
            }
            case "trainer-sessions":
            {
                var trainers = await db.Trainers.AsNoTracking().IgnoreQueryFilters().ToDictionaryAsync(t => t.Id, t => t, ct);
                var s = await db.PtSessions.AsNoTracking().Where(x => x.Status == PtSessionStatus.Completed && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0)
                    .GroupBy(x => x.TrainerId).Select(g => new { g.Key, N = g.Count() }).ToListAsync(ct);
                rows = s.OrderByDescending(x => x.N).Select(x => new Dictionary<string, object?> { ["Trainer"] = trainers.GetValueOrDefault(x.Key)?.Name, ["Sessions given"] = x.N,
                    ["Value"] = x.N * (trainers.GetValueOrDefault(x.Key)?.SessionRate ?? 0m),
                    ["Commission"] = x.N * (trainers.GetValueOrDefault(x.Key)?.SessionRate ?? 0m) * (trainers.GetValueOrDefault(x.Key)?.CommissionPct ?? 0m) / 100m }).ToList();
                break;
            }
            case "leads":
            {
                var l = db.Leads.AsNoTracking().Where(x => !x.IsDeleted);
                var list = (await l.ToListAsync(ct)).Where(x => string.CompareOrdinal(x.CreatedAt.ToString("yyyy-MM-dd"), from) >= 0 && string.CompareOrdinal(x.CreatedAt.ToString("yyyy-MM-dd"), to) <= 0
                    && (q.BranchId == null || x.BranchId == q.BranchId));
                rows = list.GroupBy(x => x.Source ?? "Unknown").Select(g => new Dictionary<string, object?> { ["Source"] = g.Key, ["Leads"] = g.Count(),
                    ["Converted"] = g.Count(x => x.Status == LeadStatus.Converted), ["Lost"] = g.Count(x => x.Status == LeadStatus.Lost) }).OrderByDescending(x => x["Leads"]).ToList();
                break;
            }
            default:
                return Result.Failure<FitnessReportResult>(Error.Custom("Report.NotFound", "Unknown report."));
        }
        return Result.Success(new FitnessReportResult(rows, rows.Count));
    }
}
