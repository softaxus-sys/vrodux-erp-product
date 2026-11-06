using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Fitness.Application.Abstractions;
using Softaxis.Fitness.Application.Facility;
using Softaxis.Fitness.Application.Members;
using Softaxis.Fitness.Domain.Entities;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Handlers;

// ── Equipment ───────────────────────────────────────────────────────────────

internal static class EquipmentReader
{
    public static EquipmentDto ToDto(Equipment e, string? branch, decimal cost, string today) => new(e.Id, e.Name, e.Category,
        e.Brand, e.Model, e.SerialNumber, e.BranchId, branch, e.Location, e.PurchasedOn, e.PurchaseCost, e.WarrantyUntil,
        e.ServiceIntervalDays, e.LastServicedOn, e.NextServiceOn, e.Status, e.Notes,
        e.Status != EquipmentStatus.Retired && e.NextServiceOn != null && string.CompareOrdinal(e.NextServiceOn, today) <= 0, cost);

    public static async Task<EquipmentDto> OneAsync(FitnessDbContext db, Equipment e, CancellationToken ct)
    {
        var branches = await Fx.BranchNamesAsync(db, ct);
        var cost = await db.Maintenance.Where(m => m.EquipmentId == e.Id).SumAsync(m => (decimal?)m.Cost, ct) ?? 0m;
        return ToDto(e, branches.GetValueOrDefault(e.BranchId), cost, Fx.Today(null));
    }
}

internal sealed class GetEquipmentHandler(FitnessDbContext db) : IQueryHandler<GetEquipmentQuery, IReadOnlyList<EquipmentDto>>
{
    public async Task<Result<IReadOnlyList<EquipmentDto>>> Handle(GetEquipmentQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var items = db.Equipment.AsNoTracking().Where(e => !e.IsDeleted);
        if (q.BranchId is { } b) items = items.Where(e => e.BranchId == b);
        if (!string.IsNullOrWhiteSpace(q.Status)) items = items.Where(e => e.Status == q.Status);
        var list = await items.OrderBy(e => e.Name).ToListAsync(ct);
        var branches = await Fx.BranchNamesAsync(db, ct);
        var costs = await db.Maintenance.AsNoTracking().GroupBy(m => m.EquipmentId)
            .Select(g => new { g.Key, Sum = g.Sum(m => m.Cost) }).ToDictionaryAsync(x => x.Key, x => x.Sum, ct);
        var rows = list.Select(e => EquipmentReader.ToDto(e, branches.GetValueOrDefault(e.BranchId), costs.GetValueOrDefault(e.Id), today));
        if (q.ServiceDueOnly) rows = rows.Where(r => r.ServiceDue);
        return Result.Success<IReadOnlyList<EquipmentDto>>(rows.ToList());
    }
}

internal sealed class SaveEquipmentHandler(FitnessDbContext db) : ICommandHandler<SaveEquipmentCommand, EquipmentDto>
{
    public async Task<Result<EquipmentDto>> Handle(SaveEquipmentCommand c, CancellationToken ct)
    {
        if (!await db.Branches.AnyAsync(b => b.Id == c.BranchId && !b.IsDeleted, ct)) return Result.Failure<EquipmentDto>(Fx.NotFound("Branch"));
        if (!EquipmentStatus.All.Contains(c.Status)) return Result.Failure<EquipmentDto>(Error.Custom("Validation.Failed", "Unknown status."));
        Equipment? e;
        if (c.Id is { } id)
        {
            e = await db.Equipment.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (e is null) return Result.Failure<EquipmentDto>(Fx.NotFound("Equipment"));
        }
        else { e = new Equipment(c.Name, c.BranchId); db.Equipment.Add(e); }
        // New equipment with an interval but no date gets its first service scheduled from purchase/today.
        var next = c.NextServiceOn;
        if (string.IsNullOrWhiteSpace(next) && c.ServiceIntervalDays > 0)
            next = Fx.Add(Dates.Valid(c.PurchasedOn) ? c.PurchasedOn! : Fx.Today(null), c.ServiceIntervalDays);
        e.Update(c.Name, c.Category, c.Brand, c.Model, c.SerialNumber, c.BranchId, c.Location, c.PurchasedOn, c.PurchaseCost,
            c.WarrantyUntil, c.ServiceIntervalDays, next, c.Status, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success(await EquipmentReader.OneAsync(db, e, ct));
    }
}

internal sealed class DeleteEquipmentHandler(FitnessDbContext db) : ICommandHandler<DeleteEquipmentCommand>
{
    public async Task<Result> Handle(DeleteEquipmentCommand c, CancellationToken ct)
    {
        var e = await db.Equipment.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (e is null) return Result.Failure(Fx.NotFound("Equipment"));
        e.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetMaintenanceHandler(FitnessDbContext db) : IQueryHandler<GetMaintenanceQuery, IReadOnlyList<MaintenanceDto>>
{
    public async Task<Result<IReadOnlyList<MaintenanceDto>>> Handle(GetMaintenanceQuery q, CancellationToken ct) =>
        Result.Success<IReadOnlyList<MaintenanceDto>>((await db.Maintenance.AsNoTracking().Where(m => m.EquipmentId == q.EquipmentId)
            .OrderByDescending(m => m.Date).ThenByDescending(m => m.CreatedAt).ToListAsync(ct))
            .Select(m => new MaintenanceDto(m.Id, m.EquipmentId, m.Date, m.Type, m.Description, m.Cost, m.PerformedBy,
                m.StatusAfter, m.RecordedByName, m.CreatedAt)).ToList());
}

internal sealed class RecordMaintenanceHandler(FitnessDbContext db, ICurrentUser user) : ICommandHandler<RecordMaintenanceCommand, MaintenanceDto>
{
    public async Task<Result<MaintenanceDto>> Handle(RecordMaintenanceCommand c, CancellationToken ct)
    {
        var e = await db.Equipment.FirstOrDefaultAsync(x => x.Id == c.EquipmentId && !x.IsDeleted, ct);
        if (e is null) return Result.Failure<MaintenanceDto>(Fx.NotFound("Equipment"));
        if (!EquipmentStatus.All.Contains(c.StatusAfter)) return Result.Failure<MaintenanceDto>(Error.Custom("Validation.Failed", "Unknown status."));

        var log = new MaintenanceLog(e.Id, c.Date, c.Type, c.Description, c.Cost, c.PerformedBy, c.StatusAfter, user.Name);
        db.Maintenance.Add(log);
        // A service resets the clock; a repair or inspection only updates the condition.
        var isService = string.Equals(c.Type, "service", StringComparison.OrdinalIgnoreCase);
        e.RecordService(isService ? c.Date : e.LastServicedOn ?? c.Date,
            isService && e.ServiceIntervalDays > 0 ? Fx.Add(c.Date, e.ServiceIntervalDays) : e.NextServiceOn, c.StatusAfter);
        await db.SaveChangesAsync(ct);
        return Result.Success(new MaintenanceDto(log.Id, log.EquipmentId, log.Date, log.Type, log.Description, log.Cost,
            log.PerformedBy, log.StatusAfter, log.RecordedByName, log.CreatedAt));
    }
}

// ── Lockers ─────────────────────────────────────────────────────────────────

internal static class LockerReader
{
    public static string State(Locker l, string today) =>
        l.OutOfUse ? "out_of_use"
        : l.MemberId is null ? "available"
        : l.AssignedUntil != null && string.CompareOrdinal(l.AssignedUntil, today) < 0 ? "expired"
        : "assigned";

    public static async Task<List<LockerDto>> ToDtosAsync(FitnessDbContext db, IReadOnlyCollection<Locker> lockers, string today, CancellationToken ct)
    {
        var branches = await Fx.BranchNamesAsync(db, ct);
        var ids = lockers.Where(l => l.MemberId != null).Select(l => l.MemberId!.Value).Distinct().ToList();
        var members = await db.Members.AsNoTracking().IgnoreQueryFilters().Where(m => ids.Contains(m.Id)).ToDictionaryAsync(m => m.Id, ct);
        return lockers.Select(l => new LockerDto(l.Id, l.Number, l.BranchId, branches.GetValueOrDefault(l.BranchId), l.Area, l.Size,
            l.MonthlyRate, l.MemberId, l.MemberId is { } m ? members.GetValueOrDefault(m)?.FullName : null,
            l.MemberId is { } m2 ? members.GetValueOrDefault(m2)?.MemberNumber : null, l.AssignedFrom, l.AssignedUntil,
            l.OutOfUse, l.Notes, State(l, today))).ToList();
    }
}

internal sealed class GetLockersHandler(FitnessDbContext db) : IQueryHandler<GetLockersQuery, IReadOnlyList<LockerDto>>
{
    public async Task<Result<IReadOnlyList<LockerDto>>> Handle(GetLockersQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var l = db.Lockers.AsNoTracking().Where(x => !x.IsDeleted);
        if (q.BranchId is { } b) l = l.Where(x => x.BranchId == b);
        var list = (await l.OrderBy(x => x.Number).ToListAsync(ct)).OrderBy(x => x.Number.Length).ThenBy(x => x.Number).ToList();
        if (!string.IsNullOrWhiteSpace(q.State)) list = list.Where(x => LockerReader.State(x, today) == q.State).ToList();
        return Result.Success<IReadOnlyList<LockerDto>>(await LockerReader.ToDtosAsync(db, list, today, ct));
    }
}

internal sealed class SaveLockerHandler(FitnessDbContext db) : ICommandHandler<SaveLockerCommand, LockerDto>
{
    public async Task<Result<LockerDto>> Handle(SaveLockerCommand c, CancellationToken ct)
    {
        if (!await db.Branches.AnyAsync(b => b.Id == c.BranchId && !b.IsDeleted, ct)) return Result.Failure<LockerDto>(Fx.NotFound("Branch"));
        var number = c.Number.Trim();
        if (await db.Lockers.AnyAsync(l => !l.IsDeleted && l.BranchId == c.BranchId && l.Number == number && l.Id != c.Id, ct))
            return Result.Failure<LockerDto>(Error.Custom("Locker.Duplicate", "This branch already has a locker with that number."));
        Locker? l;
        if (c.Id is { } id)
        {
            l = await db.Lockers.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (l is null) return Result.Failure<LockerDto>(Fx.NotFound("Locker"));
        }
        else { l = new Locker(c.Number, c.BranchId); db.Lockers.Add(l); }
        l.Update(c.Number, c.Area, c.Size, c.MonthlyRate, c.OutOfUse, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await LockerReader.ToDtosAsync(db, [l], Fx.Today(null), ct))[0]);
    }
}

internal sealed class AddLockersHandler(FitnessDbContext db) : ICommandHandler<AddLockersCommand, int>
{
    public async Task<Result<int>> Handle(AddLockersCommand c, CancellationToken ct)
    {
        if (!await db.Branches.AnyAsync(b => b.Id == c.BranchId && !b.IsDeleted, ct)) return Result.Failure<int>(Fx.NotFound("Branch"));
        if (c.To < c.From || c.To - c.From >= 500) return Result.Failure<int>(Error.Custom("Validation.Failed", "Add up to 500 lockers at a time."));
        var existing = (await db.Lockers.Where(l => !l.IsDeleted && l.BranchId == c.BranchId).Select(l => l.Number).ToListAsync(ct)).ToHashSet();
        var added = 0;
        for (var n = c.From; n <= c.To; n++)
        {
            var number = $"{c.Prefix?.Trim()}{n}";
            if (!existing.Add(number)) continue;   // skip numbers already there so a re-run is harmless
            var l = new Locker(number, c.BranchId);
            l.Update(number, c.Area, c.Size, c.MonthlyRate, false, null);
            db.Lockers.Add(l);
            added++;
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(added);
    }
}

internal sealed class AssignLockerHandler(FitnessDbContext db) : ICommandHandler<AssignLockerCommand, LockerDto>
{
    public async Task<Result<LockerDto>> Handle(AssignLockerCommand c, CancellationToken ct)
    {
        var today = Fx.Today(c.Today);
        var l = await db.Lockers.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (l is null) return Result.Failure<LockerDto>(Fx.NotFound("Locker"));
        if (l.OutOfUse) return Result.Failure<LockerDto>(Fx.Conflict("Locker", "This locker is out of use."));
        var state = LockerReader.State(l, today);
        if (state is "assigned") return Result.Failure<LockerDto>(Fx.Conflict("Locker", "This locker is already assigned."));
        if (!await db.Members.AnyAsync(m => m.Id == c.MemberId && !m.IsDeleted, ct)) return Result.Failure<LockerDto>(Fx.NotFound("Member"));
        if (await db.Lockers.AnyAsync(x => !x.IsDeleted && x.Id != l.Id && x.MemberId == c.MemberId, ct))
            return Result.Failure<LockerDto>(Fx.Conflict("Locker", "This member already has a locker."));
        l.Assign(c.MemberId, Dates.Valid(c.From) ? c.From! : today, c.Until);
        await db.SaveChangesAsync(ct);
        return Result.Success((await LockerReader.ToDtosAsync(db, [l], today, ct))[0]);
    }
}

internal sealed class ReleaseLockerHandler(FitnessDbContext db) : ICommandHandler<ReleaseLockerCommand, LockerDto>
{
    public async Task<Result<LockerDto>> Handle(ReleaseLockerCommand c, CancellationToken ct)
    {
        var l = await db.Lockers.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (l is null) return Result.Failure<LockerDto>(Fx.NotFound("Locker"));
        l.Release();
        await db.SaveChangesAsync(ct);
        return Result.Success((await LockerReader.ToDtosAsync(db, [l], Fx.Today(null), ct))[0]);
    }
}

internal sealed class DeleteLockerHandler(FitnessDbContext db) : ICommandHandler<DeleteLockerCommand>
{
    public async Task<Result> Handle(DeleteLockerCommand c, CancellationToken ct)
    {
        var l = await db.Lockers.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (l is null) return Result.Failure(Fx.NotFound("Locker"));
        if (l.MemberId is not null) return Result.Failure(Fx.Conflict("Locker", "Release this locker before deleting it."));
        l.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Leads ───────────────────────────────────────────────────────────────────

internal static class LeadReader
{
    public static LeadDto ToDto(FitnessLead l, string? branch, string today) => new(l.Id, l.Name, l.Phone, l.Email, l.Gender,
        l.Source, l.Interest, l.BranchId, branch, l.AssignedToUserId, l.AssignedToName, l.Status, l.TrialDate, l.FollowUpOn,
        l.LostReason, l.Notes, l.MemberId,
        l.FollowUpOn != null && l.Status is not (LeadStatus.Converted or LeadStatus.Lost) && string.CompareOrdinal(l.FollowUpOn, today) <= 0,
        l.CreatedAt);
}

internal sealed class GetLeadsHandler(FitnessDbContext db) : IQueryHandler<GetLeadsQuery, IReadOnlyList<LeadDto>>
{
    public async Task<Result<IReadOnlyList<LeadDto>>> Handle(GetLeadsQuery q, CancellationToken ct)
    {
        var today = Fx.Today(q.Today);
        var leads = db.Leads.AsNoTracking().Where(l => !l.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Status)) leads = leads.Where(l => l.Status == q.Status);
        if (q.BranchId is { } b) leads = leads.Where(l => l.BranchId == b);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            leads = leads.Where(l => l.Name.Contains(s) || (l.Phone != null && l.Phone.Contains(s)) || (l.Email != null && l.Email.Contains(s)));
        }
        var branches = await Fx.BranchNamesAsync(db, ct);
        var rows = (await leads.OrderByDescending(l => l.CreatedAt).Take(1000).ToListAsync(ct))
            .Select(l => LeadReader.ToDto(l, l.BranchId is { } id ? branches.GetValueOrDefault(id) : null, today));
        if (q.FollowUpDueOnly) rows = rows.Where(r => r.FollowUpDue);
        return Result.Success<IReadOnlyList<LeadDto>>(rows.ToList());
    }
}

internal sealed class SaveLeadHandler(FitnessDbContext db) : ICommandHandler<SaveLeadCommand, LeadDto>
{
    public async Task<Result<LeadDto>> Handle(SaveLeadCommand c, CancellationToken ct)
    {
        if (!LeadStatus.All.Contains(c.Status)) return Result.Failure<LeadDto>(Error.Custom("Validation.Failed", "Unknown status."));
        FitnessLead? l;
        if (c.Id is { } id)
        {
            l = await db.Leads.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (l is null) return Result.Failure<LeadDto>(Fx.NotFound("Lead"));
        }
        else { l = new FitnessLead(c.Name); db.Leads.Add(l); }
        l.Update(c.Name, c.Phone, c.Email, c.Gender, c.Source, c.Interest, c.BranchId, c.AssignedToUserId, c.AssignedToName,
            c.Status, c.TrialDate, c.FollowUpOn, c.LostReason, c.Notes);
        await db.SaveChangesAsync(ct);
        var branches = await Fx.BranchNamesAsync(db, ct);
        return Result.Success(LeadReader.ToDto(l, l.BranchId is { } b ? branches.GetValueOrDefault(b) : null, Fx.Today(null)));
    }
}

internal sealed class DeleteLeadHandler(FitnessDbContext db) : ICommandHandler<DeleteLeadCommand>
{
    public async Task<Result> Handle(DeleteLeadCommand c, CancellationToken ct)
    {
        var l = await db.Leads.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (l is null) return Result.Failure(Fx.NotFound("Lead"));
        l.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
