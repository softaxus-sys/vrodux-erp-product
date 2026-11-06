using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

/// <summary>Small helpers shared by every handler: dates, numbering, derived membership state.</summary>
internal static class Fx
{
    public static string Today(string? sent) => Dates.Valid(sent) ? sent! : DateTime.UtcNow.ToString("yyyy-MM-dd");
    public static DateOnly D(string s) => DateOnly.ParseExact(s, "yyyy-MM-dd");
    public static string S(DateOnly d) => d.ToString("yyyy-MM-dd");
    public static string Add(string date, int days) => S(D(date).AddDays(days));
    public static int DaysBetween(string from, string to) => D(to).DayNumber - D(from).DayNumber;

    public static Error NotFound(string what) => Error.Custom($"{what}.NotFound", $"{what} was not found.");
    public static Error Conflict(string what, string text) => Error.Custom($"{what}.Conflict", text);

    /// <summary>The workspace settings row, created on first read.</summary>
    public static async Task<FitnessSettings> SettingsAsync(FitnessDbContext db, CancellationToken ct)
    {
        var s = await db.Settings.FirstOrDefaultAsync(ct);
        if (s is not null) return s;
        s = FitnessSettings.CreateDefault();
        db.Settings.Add(s);
        await db.SaveChangesAsync(ct);
        return s;
    }

    /// <summary>Next number for a counter (member numbers, receipts). Saved with the caller's own save.</summary>
    public static async Task<int> NextAsync(FitnessDbContext db, string kind, CancellationToken ct)
    {
        var c = db.Counters.Local.FirstOrDefault(x => x.Kind == kind) ?? await db.Counters.FirstOrDefaultAsync(x => x.Kind == kind, ct);
        if (c is null) { c = new FitnessCounter(kind); db.Counters.Add(c); }
        return c.Next();
    }

    /// <summary>Every workspace has at least one branch; the first is created on first read.</summary>
    public static async Task<List<FitnessBranch>> BranchesAsync(FitnessDbContext db, CancellationToken ct)
    {
        var list = await db.Branches.Where(b => !b.IsDeleted).OrderBy(b => b.Name).ToListAsync(ct);
        if (list.Count > 0) return list;
        var main = new FitnessBranch("Main Branch", "MAIN", null, null, null, "06:00", "22:00", null);
        db.Branches.Add(main);
        await db.SaveChangesAsync(ct);
        return [main];
    }

    public static async Task<Dictionary<Guid, string>> BranchNamesAsync(FitnessDbContext db, CancellationToken ct) =>
        (await db.Branches.AsNoTracking().Where(b => !b.IsDeleted).ToListAsync(ct)).ToDictionary(b => b.Id, b => b.Name);

    public static async Task<Dictionary<Guid, string>> TrainerNamesAsync(FitnessDbContext db, CancellationToken ct) =>
        (await db.Trainers.AsNoTracking().Where(t => !t.IsDeleted).ToListAsync(ct)).ToDictionary(t => t.Id, t => t.Name);

    /// <summary>Lifecycle of a subscription from its dates; expired and upcoming are never stored.</summary>
    public static string State(Subscription s, string today)
    {
        if (s.Status == SubscriptionStatus.Cancelled) return "cancelled";
        if (s.Status == SubscriptionStatus.Frozen) return "frozen";
        if (string.CompareOrdinal(today, s.EndDate) > 0) return "expired";
        if (string.CompareOrdinal(today, s.StartDate) < 0) return "upcoming";
        return "active";
    }

    /// <summary>The subscription that decides a member's standing today: running first, then the one ending last.</summary>
    public static Subscription? Current(IEnumerable<Subscription> subs, string today)
    {
        var live = subs.Where(s => !s.IsDeleted && s.Status != SubscriptionStatus.Cancelled).ToList();
        return live.Where(s => State(s, today) is "active" or "frozen").OrderByDescending(s => s.EndDate).FirstOrDefault()
            ?? live.Where(s => State(s, today) == "upcoming").OrderBy(s => s.StartDate).FirstOrDefault()
            ?? live.OrderByDescending(s => s.EndDate).FirstOrDefault();
    }

    /// <summary>Membership standing used by the member list filter and badges.</summary>
    public static string MembershipState(Subscription? cur, string today, int expiringWithin)
    {
        if (cur is null) return "none";
        var st = State(cur, today);
        return st == "active" && DaysBetween(today, cur.EndDate) <= expiringWithin ? "expiring" : st;
    }

    public static SubscriptionDto ToDto(Subscription s, string today) => new(
        s.Id, s.MemberId, s.PlanId, s.PlanName, s.Category, s.BranchId, s.StartDate, s.EndDate, s.DurationDays,
        s.Price, s.Discount, s.JoiningFee, s.Total, s.AmountPaid, s.Balance, s.ClassCredits, s.ClassCreditsLeft,
        s.PtSessionsLeft, s.VisitsPerDay, s.TotalVisits, s.VisitsUsed, s.AllowFreeze, s.MaxFreezeDays,
        s.FreezeDaysUsed, s.GuestPassesLeft, s.AllBranches, s.AccessFrom, s.AccessUntil, s.Status, State(s, today),
        s.FrozenFrom, s.CancelledOn, s.CancelReason, s.RenewedFromId, s.SoldByName, s.Notes, s.CreatedAt);

    /// <summary>Money still owed per member across live subscriptions and training packages.</summary>
    public static async Task<Dictionary<Guid, decimal>> BalancesAsync(FitnessDbContext db, IReadOnlyCollection<Guid>? memberIds, CancellationToken ct)
    {
        var subs = db.Subscriptions.AsNoTracking().Where(s => !s.IsDeleted && s.Status != SubscriptionStatus.Cancelled);
        var pts = db.PtPackages.AsNoTracking().Where(p => !p.IsDeleted && !p.IsCancelled);
        if (memberIds is not null)
        {
            subs = subs.Where(s => memberIds.Contains(s.MemberId));
            pts = pts.Where(p => memberIds.Contains(p.MemberId));
        }
        var result = new Dictionary<Guid, decimal>();
        foreach (var s in await subs.ToListAsync(ct)) result[s.MemberId] = result.GetValueOrDefault(s.MemberId) + s.Balance;
        foreach (var p in await pts.ToListAsync(ct)) result[p.MemberId] = result.GetValueOrDefault(p.MemberId) + p.Balance;
        return result;
    }
}
