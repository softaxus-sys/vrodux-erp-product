using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Setup;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

// ── Branches ────────────────────────────────────────────────────────────────

internal static class BranchReader
{
    public static async Task<BranchDto> ToDtoAsync(FitnessDbContext db, FitnessBranch b, CancellationToken ct)
    {
        var members = await db.Members.CountAsync(m => !m.IsDeleted && m.HomeBranchId == b.Id, ct);
        var inGym = await DeskRules.InGym(db, DateTime.UtcNow.ToString("yyyy-MM-dd")).CountAsync(c => c.BranchId == b.Id, ct);
        return new BranchDto(b.Id, b.Name, b.Code, b.Address, b.Phone, b.Email, b.OpeningTime, b.ClosingTime,
            b.Capacity, b.IsActive, members, inGym);
    }
}

internal sealed class GetBranchesHandler(FitnessDbContext db) : IQueryHandler<GetBranchesQuery, IReadOnlyList<BranchDto>>
{
    public async Task<Result<IReadOnlyList<BranchDto>>> Handle(GetBranchesQuery q, CancellationToken ct)
    {
        var branches = await Fx.BranchesAsync(db, ct);
        if (q.ActiveOnly) branches = branches.Where(b => b.IsActive).ToList();
        var list = new List<BranchDto>();
        foreach (var b in branches) list.Add(await BranchReader.ToDtoAsync(db, b, ct));
        return Result.Success<IReadOnlyList<BranchDto>>(list);
    }
}

internal sealed class SaveBranchHandler(FitnessDbContext db) : ICommandHandler<SaveBranchCommand, BranchDto>
{
    public async Task<Result<BranchDto>> Handle(SaveBranchCommand c, CancellationToken ct)
    {
        var name = c.Name.Trim();
        if (await db.Branches.AnyAsync(b => !b.IsDeleted && b.Name == name && b.Id != c.Id, ct))
            return Result.Failure<BranchDto>(Error.Custom("Branch.Duplicate", "A branch with this name already exists."));

        FitnessBranch? b;
        if (c.Id is { } id)
        {
            b = await db.Branches.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (b is null) return Result.Failure<BranchDto>(Fx.NotFound("Branch"));
            b.Update(c.Name, c.Code, c.Address, c.Phone, c.Email, c.OpeningTime, c.ClosingTime, c.Capacity, c.IsActive);
        }
        else
        {
            b = new FitnessBranch(c.Name, c.Code, c.Address, c.Phone, c.Email, c.OpeningTime, c.ClosingTime, c.Capacity);
            db.Branches.Add(b);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(await BranchReader.ToDtoAsync(db, b, ct));
    }
}

internal sealed class DeleteBranchHandler(FitnessDbContext db) : ICommandHandler<DeleteBranchCommand>
{
    public async Task<Result> Handle(DeleteBranchCommand c, CancellationToken ct)
    {
        var b = await db.Branches.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Fx.NotFound("Branch"));
        if (await db.Branches.CountAsync(x => !x.IsDeleted, ct) <= 1)
            return Result.Failure(Fx.Conflict("Branch", "You need at least one branch."));
        if (await db.Members.AnyAsync(m => !m.IsDeleted && m.HomeBranchId == b.Id, ct)
            || await db.Equipment.AnyAsync(e => !e.IsDeleted && e.BranchId == b.Id, ct)
            || await db.Lockers.AnyAsync(l => !l.IsDeleted && l.BranchId == b.Id, ct))
            return Result.Failure(Fx.Conflict("Branch", "This branch still has members, equipment or lockers. Move them first."));
        b.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Plans ───────────────────────────────────────────────────────────────────

internal static class PlanReader
{
    public static PlanDto ToDto(MembershipPlan p, int active) => new(p.Id, p.Name, p.Code, p.Description, p.Category,
        p.DurationDays, p.Price, p.JoiningFee, p.ClassCredits, p.PtSessions, p.VisitsPerDay, p.TotalVisits,
        p.AllowFreeze, p.MaxFreezeDays, p.GuestPasses, p.AllBranches, p.AccessFrom, p.AccessUntil, p.IsActive, active);

    public static async Task<int> ActiveCountAsync(FitnessDbContext db, Guid planId, CancellationToken ct)
    {
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        return await db.Subscriptions.CountAsync(s => !s.IsDeleted && s.PlanId == planId
            && s.Status != SubscriptionStatus.Cancelled && string.Compare(s.EndDate, today) >= 0, ct);
    }
}

internal sealed class GetPlansHandler(FitnessDbContext db) : IQueryHandler<GetPlansQuery, IReadOnlyList<PlanDto>>
{
    public async Task<Result<IReadOnlyList<PlanDto>>> Handle(GetPlansQuery q, CancellationToken ct)
    {
        var plans = db.Plans.AsNoTracking().Where(p => !p.IsDeleted);
        if (q.ActiveOnly) plans = plans.Where(p => p.IsActive);
        var list = await plans.OrderBy(p => p.Category).ThenBy(p => p.Price).ToListAsync(ct);

        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var counts = await db.Subscriptions.AsNoTracking()
            .Where(s => !s.IsDeleted && s.Status != SubscriptionStatus.Cancelled && string.Compare(s.EndDate, today) >= 0)
            .GroupBy(s => s.PlanId).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);

        return Result.Success<IReadOnlyList<PlanDto>>(list.Select(p => PlanReader.ToDto(p, counts.GetValueOrDefault(p.Id))).ToList());
    }
}

internal sealed class SavePlanHandler(FitnessDbContext db) : ICommandHandler<SavePlanCommand, PlanDto>
{
    public async Task<Result<PlanDto>> Handle(SavePlanCommand c, CancellationToken ct)
    {
        var name = c.Name.Trim();
        if (await db.Plans.AnyAsync(p => !p.IsDeleted && p.Name == name && p.Id != c.Id, ct))
            return Result.Failure<PlanDto>(Error.Custom("Plan.Duplicate", "A plan with this name already exists."));

        MembershipPlan? p;
        if (c.Id is { } id)
        {
            p = await db.Plans.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (p is null) return Result.Failure<PlanDto>(Fx.NotFound("Plan"));
        }
        else
        {
            p = new MembershipPlan(c.Name);
            db.Plans.Add(p);
        }
        // Subscriptions copy these values when sold, so editing a plan never changes a sold membership.
        p.Update(c.Name, c.Code, c.Description, c.Category, c.DurationDays, c.Price, c.JoiningFee, c.ClassCredits,
            c.PtSessions, c.VisitsPerDay, c.TotalVisits, c.AllowFreeze, c.MaxFreezeDays, c.GuestPasses,
            c.AllBranches, c.AccessFrom, c.AccessUntil, c.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(PlanReader.ToDto(p, await PlanReader.ActiveCountAsync(db, p.Id, ct)));
    }
}

internal sealed class DeletePlanHandler(FitnessDbContext db) : ICommandHandler<DeletePlanCommand>
{
    public async Task<Result> Handle(DeletePlanCommand c, CancellationToken ct)
    {
        var p = await db.Plans.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure(Fx.NotFound("Plan"));
        if (await PlanReader.ActiveCountAsync(db, p.Id, ct) > 0)
            return Result.Failure(Fx.Conflict("Plan", "Members are still on this plan. Switch it off instead of deleting it."));
        p.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Settings ────────────────────────────────────────────────────────────────

internal static class SettingsReader
{
    public static SettingsDto ToDto(FitnessSettings s) => new(s.MemberNumberPrefix, s.GraceDays, s.AllowCheckInWithDues,
        s.RequireWaiver, s.ExpiringWithinDays, s.LateCancelHours, s.ChargeCreditForNoShow, s.BookingWindowDays,
        s.ExpiryAlertsEnabled);
}

internal sealed class GetSettingsHandler(FitnessDbContext db) : IQueryHandler<GetSettingsQuery, SettingsDto>
{
    public async Task<Result<SettingsDto>> Handle(GetSettingsQuery q, CancellationToken ct) =>
        Result.Success(SettingsReader.ToDto(await Fx.SettingsAsync(db, ct)));
}

internal sealed class UpdateSettingsHandler(FitnessDbContext db) : ICommandHandler<UpdateSettingsCommand, SettingsDto>
{
    public async Task<Result<SettingsDto>> Handle(UpdateSettingsCommand c, CancellationToken ct)
    {
        var s = await Fx.SettingsAsync(db, ct);
        s.Update(c.MemberNumberPrefix, c.GraceDays, c.AllowCheckInWithDues, c.RequireWaiver, c.ExpiringWithinDays,
            c.LateCancelHours, c.ChargeCreditForNoShow, c.BookingWindowDays, c.ExpiryAlertsEnabled);
        await db.SaveChangesAsync(ct);
        return Result.Success(SettingsReader.ToDto(s));
    }
}
