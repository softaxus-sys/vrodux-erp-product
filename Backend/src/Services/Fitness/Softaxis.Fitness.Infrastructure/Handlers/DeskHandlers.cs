using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Abstractions;
using Softaxis.Fitness.Application.Desk;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

internal static class DeskRules
{
    /// <summary>Someone still "in" after this long is treated as having left without checking out.</summary>
    public static readonly TimeSpan MaxStay = TimeSpan.FromHours(6);

    public static async Task<FitnessMember?> FindMemberAsync(FitnessDbContext db, string reference, CancellationToken ct)
    {
        var r = reference.Trim();
        if (Guid.TryParse(r, out var id))
            return await db.Members.FirstOrDefaultAsync(m => m.Id == id && !m.IsDeleted, ct);
        var lower = r.ToLower();
        return await db.Members.FirstOrDefaultAsync(m => !m.IsDeleted
            && (m.MemberNumber.ToLower() == lower || m.Phone == r || m.Email == lower), ct);
    }

    public static VisitDto ToVisit(CheckIn c, FitnessMember? m, string? branch) => new(c.Id, c.MemberId, m?.FullName ?? "",
        m?.MemberNumber ?? "", c.BranchId, branch, c.Date, c.CheckedInAt, c.CheckedOutAt, c.Allowed, c.DenyReason, c.Method,
        c.IsGuest, c.GuestName, c.RecordedByName);

    public static IQueryable<CheckIn> InGym(FitnessDbContext db, string today)
    {
        var cutoff = DateTime.UtcNow - MaxStay;
        return db.CheckIns.Where(c => c.Allowed && c.CheckedOutAt == null && c.Date == today && c.CheckedInAt > cutoff);
    }
}

internal sealed class CheckInHandler(FitnessDbContext db, ICurrentUser user) : ICommandHandler<CheckInCommand, CheckInResultDto>
{
    public async Task<Result<CheckInResultDto>> Handle(CheckInCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var settings = await Fx.SettingsAsync(db, ct);
        if (!await db.Branches.AnyAsync(b => b.Id == c.BranchId && !b.IsDeleted && b.IsActive, ct))
            return Result.Failure<CheckInResultDto>(Fx.NotFound("Branch"));
        var member = await DeskRules.FindMemberAsync(db, c.MemberRef, ct);
        if (member is null) return Result.Failure<CheckInResultDto>(Fx.NotFound("Member"));

        var subs = await db.Subscriptions.Where(s => s.MemberId == member.Id && !s.IsDeleted).ToListAsync(ct);
        var cur = Fx.Current(subs, today);
        var balance = (await Fx.BalancesAsync(db, [member.Id], ct)).GetValueOrDefault(member.Id);
        var warnings = new List<string>();
        string? deny = null;
        var hardDeny = false;   // reasons a desk override cannot waive

        if (member.Status == MemberStatus.Blacklisted) { deny = "This member is blacklisted."; hardDeny = true; }
        else if (member.Status == MemberStatus.Inactive) deny = "This member is marked inactive.";
        else if (settings.RequireWaiver && member.WaiverSignedOn is null) deny = "The waiver has not been signed.";
        else if (cur is null) deny = "No membership on record.";
        else
        {
            var state = Fx.State(cur, today);
            var graceEnd = Fx.Add(cur.EndDate, settings.GraceDays);
            if (state == "frozen") deny = "The membership is frozen.";
            else if (state == "upcoming") deny = $"The membership starts on {cur.StartDate}.";
            else if (state == "expired" && string.CompareOrdinal(today, graceEnd) > 0) deny = $"The membership expired on {cur.EndDate}.";
            else if (!cur.AllBranches && cur.BranchId is { } own && own != c.BranchId) deny = "This membership is for another branch.";
            else if (cur.TotalVisits is { } total && cur.VisitsUsed >= total) deny = "All visits on this pass are used.";
            else if (!string.IsNullOrEmpty(cur.AccessFrom) && !string.IsNullOrEmpty(cur.AccessUntil) && c.LocalTime is { Length: 5 } t
                     && (string.CompareOrdinal(t, cur.AccessFrom) < 0 || string.CompareOrdinal(t, cur.AccessUntil) > 0))
                deny = $"This membership is valid {cur.AccessFrom}–{cur.AccessUntil} only.";
            else if (balance > 0 && !settings.AllowCheckInWithDues) deny = $"There is an unpaid balance of {balance:0.##}.";
            else
            {
                if (state == "expired") warnings.Add($"Expired {cur.EndDate} — inside the {settings.GraceDays}-day grace period.");
                if (cur.VisitsPerDay is { } perDay)
                {
                    var todays = await db.CheckIns.CountAsync(x => x.MemberId == member.Id && x.Allowed && !x.IsGuest && x.Date == today, ct);
                    if (todays >= perDay) deny = $"Daily visit limit ({perDay}) reached.";
                }
            }
        }

        // One person cannot be in twice: a second scan while still inside is a mistake, not a visit.
        if (deny is null && await DeskRules.InGym(db, today).AnyAsync(x => x.MemberId == member.Id && !x.IsGuest, ct))
            deny = "Already checked in.";

        var overridden = false;
        if (deny is not null && c.Override && !hardDeny && deny != "Already checked in.")
        {
            warnings.Add($"Allowed by staff override: {deny}");
            deny = null;
            overridden = true;
        }

        var now = DateTime.UtcNow;
        var visit = new CheckIn(member.Id, cur?.Id, c.BranchId, today, now, deny is null, deny,
            overridden ? "override" : string.IsNullOrWhiteSpace(c.Method) ? "desk" : c.Method!, false, null, user.Id, user.Name);
        db.CheckIns.Add(visit);

        if (deny is null && cur is not null && Fx.State(cur, today) is "active" or "expired") cur.RecordVisit();
        await db.SaveChangesAsync(ct);

        if (deny is null && cur is not null)
        {
            var left = Fx.DaysBetween(today, cur.EndDate);
            if (left is >= 0 && left <= settings.ExpiringWithinDays) warnings.Add($"Membership ends in {left} day(s).");
            if (cur.ClassCredits is not null && (cur.ClassCreditsLeft ?? 0) <= 1) warnings.Add("Class credits are nearly used up.");
        }
        if (deny is null && balance > 0) warnings.Add($"Unpaid balance: {balance:0.##}.");
        if (!string.IsNullOrWhiteSpace(member.HealthNotes)) warnings.Add("Health notes on file.");

        return Result.Success(new CheckInResultDto(visit.Id, deny is null, deny, member.Id, member.FullName, member.MemberNumber,
            member.PhotoData != null, cur?.PlanName, cur?.EndDate, cur is null ? null : Fx.DaysBetween(today, cur.EndDate), balance,
            cur?.ClassCreditsLeft, cur?.TotalVisits is { } tv ? Math.Max(0, tv - cur.VisitsUsed) : null, member.HealthNotes, warnings, now));
    }
}

internal sealed class GuestCheckInHandler(FitnessDbContext db, ICurrentUser user) : ICommandHandler<GuestCheckInCommand, VisitDto>
{
    public async Task<Result<VisitDto>> Handle(GuestCheckInCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var host = await db.Members.FirstOrDefaultAsync(m => m.Id == c.HostMemberId && !m.IsDeleted, ct);
        if (host is null) return Result.Failure<VisitDto>(Fx.NotFound("Member"));
        var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == c.BranchId && !b.IsDeleted, ct);
        if (branch is null) return Result.Failure<VisitDto>(Fx.NotFound("Branch"));

        var sub = (await db.Subscriptions.Where(s => s.MemberId == host.Id && !s.IsDeleted).ToListAsync(ct))
            .FirstOrDefault(s => Fx.State(s, today) == "active" && s.GuestPassesLeft > 0);
        if (sub is null) return Result.Failure<VisitDto>(Fx.Conflict("Guest", "This member has no guest passes left."));

        sub.UseGuestPass();
        var visit = new CheckIn(host.Id, sub.Id, branch.Id, today, DateTime.UtcNow, true, null, "guest", true, c.GuestName, user.Id, user.Name);
        db.CheckIns.Add(visit);
        await db.SaveChangesAsync(ct);
        return Result.Success(DeskRules.ToVisit(visit, host, branch.Name));
    }
}

internal sealed class CheckOutHandler(FitnessDbContext db) : ICommandHandler<CheckOutCommand, VisitDto>
{
    public async Task<Result<VisitDto>> Handle(CheckOutCommand c, CancellationToken ct)
    {
        var v = await db.CheckIns.FirstOrDefaultAsync(x => x.Id == c.VisitId, ct);
        if (v is null) return Result.Failure<VisitDto>(Fx.NotFound("Visit"));
        if (v.CheckedOutAt is not null) return Result.Failure<VisitDto>(Fx.Conflict("Visit", "Already checked out."));
        v.CheckOut(DateTime.UtcNow);
        await db.SaveChangesAsync(ct);
        var m = await db.Members.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == v.MemberId, ct);
        var branches = await Fx.BranchNamesAsync(db, ct);
        return Result.Success(DeskRules.ToVisit(v, m, branches.GetValueOrDefault(v.BranchId)));
    }
}

internal sealed class CheckOutAllHandler(FitnessDbContext db) : ICommandHandler<CheckOutAllCommand, int>
{
    public async Task<Result<int>> Handle(CheckOutAllCommand c, CancellationToken ct)
    {
        var open = await db.CheckIns.Where(x => x.BranchId == c.BranchId && x.Allowed && x.CheckedOutAt == null).ToListAsync(ct);
        var now = DateTime.UtcNow;
        foreach (var v in open) v.CheckOut(now);
        await db.SaveChangesAsync(ct);
        return Result.Success(open.Count);
    }
}

internal sealed class GetVisitsHandler(FitnessDbContext db) : IQueryHandler<GetVisitsQuery, VisitPageDto>
{
    public async Task<Result<VisitPageDto>> Handle(GetVisitsQuery q, CancellationToken ct)
    {
        var v = db.CheckIns.AsNoTracking().AsQueryable();
        if (q.BranchId is { } b) v = v.Where(x => x.BranchId == b);
        if (q.MemberId is { } m) v = v.Where(x => x.MemberId == m);
        if (Dates.Valid(q.From)) v = v.Where(x => string.Compare(x.Date, q.From) >= 0);
        if (Dates.Valid(q.To)) v = v.Where(x => string.Compare(x.Date, q.To) <= 0);
        if (!q.IncludeRefused) v = v.Where(x => x.Allowed);
        if (q.InGymOnly) v = DeskRules.InGym(db, Fx.Today(null)).Where(x => q.BranchId == null || x.BranchId == q.BranchId);

        var total = await v.CountAsync(ct);
        var page = Math.Max(1, q.Page);
        var rows = await v.OrderByDescending(x => x.CheckedInAt).Skip((page - 1) * q.PageSize).Take(Math.Clamp(q.PageSize, 1, 500)).ToListAsync(ct);
        var ids = rows.Select(r => r.MemberId).Distinct().ToList();
        var members = await db.Members.AsNoTracking().IgnoreQueryFilters().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var branches = await Fx.BranchNamesAsync(db, ct);
        return Result.Success(new VisitPageDto(rows.Select(r => DeskRules.ToVisit(r, members.GetValueOrDefault(r.MemberId), branches.GetValueOrDefault(r.BranchId))).ToList(), total));
    }
}

internal sealed class GetOccupancyHandler(FitnessDbContext db) : IQueryHandler<GetOccupancyQuery, IReadOnlyList<OccupancyDto>>
{
    public async Task<Result<IReadOnlyList<OccupancyDto>>> Handle(GetOccupancyQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var branches = await Fx.BranchesAsync(db, ct);
        var inGym = await DeskRules.InGym(db, today).GroupBy(x => x.BranchId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var visits = await db.CheckIns.Where(x => x.Allowed && x.Date == today).GroupBy(x => x.BranchId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return Result.Success<IReadOnlyList<OccupancyDto>>(branches.Where(b => b.IsActive)
            .Select(b => new OccupancyDto(b.Id, b.Name, inGym.GetValueOrDefault(b.Id), b.Capacity, visits.GetValueOrDefault(b.Id))).ToList());
    }
}
