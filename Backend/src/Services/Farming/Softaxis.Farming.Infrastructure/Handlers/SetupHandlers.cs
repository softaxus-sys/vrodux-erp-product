using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Farming.Application;
using Softaxis.Farming.Domain.Entities;
using Softaxis.Farming.Infrastructure.Persistence;

namespace Softaxis.Farming.Infrastructure.Handlers;

/// <summary>Shared helpers: dates, errors, lookups by id.</summary>
internal static class Fm
{
    public static string Today(string? sent) => Dates.Valid(sent) ? sent! : DateTime.UtcNow.ToString("yyyy-MM-dd");
    public static DateOnly D(string s) => DateOnly.ParseExact(s, "yyyy-MM-dd");
    public static string S(DateOnly d) => d.ToString("yyyy-MM-dd");
    public static string Add(string date, int days) => S(D(date).AddDays(days));
    public static int Days(string from, string to) => D(to).DayNumber - D(from).DayNumber;

    public static Error NotFound(string what) => Error.Custom($"{what}.NotFound", $"{what} was not found.");
    public static Error Conflict(string what, string text) => Error.Custom($"{what}.Conflict", text);
    public static Error Invalid(string text) => Error.Custom("Validation.Failed", text);

    public static async Task<FarmSettings> SettingsAsync(FarmingDbContext db, CancellationToken ct)
    {
        var s = await db.Settings.FirstOrDefaultAsync(ct);
        if (s is not null) return s;
        s = FarmSettings.CreateDefault();
        db.Settings.Add(s);
        await db.SaveChangesAsync(ct);
        return s;
    }

    /// <summary>Every workspace has at least one farm; the first is created on first read.</summary>
    public static async Task<List<Farm>> FarmsAsync(FarmingDbContext db, CancellationToken ct)
    {
        var list = await db.Farms.Where(f => !f.IsDeleted).OrderBy(f => f.Name).ToListAsync(ct);
        if (list.Count > 0) return list;
        var main = new Farm("Main Farm");
        db.Farms.Add(main);
        await db.SaveChangesAsync(ct);
        return [main];
    }

    public static Task<Dictionary<Guid, string>> UnitNamesAsync(FarmingDbContext db, CancellationToken ct) =>
        db.Units.AsNoTracking().ToDictionaryAsync(u => u.Id, u => u.Name, ct);

    public static Task<Dictionary<Guid, string>> AnimalTagsAsync(FarmingDbContext db, CancellationToken ct) =>
        db.Animals.AsNoTracking().ToDictionaryAsync(a => a.Id, a => a.TagNumber, ct);

    public static Task<Dictionary<Guid, string>> BatchCodesAsync(FarmingDbContext db, CancellationToken ct) =>
        db.Batches.AsNoTracking().ToDictionaryAsync(b => b.Id, b => b.Code, ct);

    /// <summary>Optional links on a record must point at live rows of this workspace.</summary>
    public static async Task<Error?> CheckLinksAsync(FarmingDbContext db, Guid? animalId, Guid? batchId, Guid? unitId, CancellationToken ct)
    {
        if (animalId is { } a && !await db.Animals.AnyAsync(x => x.Id == a && !x.IsDeleted, ct)) return NotFound("Animal");
        if (batchId is { } b && !await db.Batches.AnyAsync(x => x.Id == b && !x.IsDeleted, ct)) return NotFound("Batch");
        if (unitId is { } u && !await db.Units.AnyAsync(x => x.Id == u && !x.IsDeleted, ct)) return NotFound("Unit");
        return null;
    }
}

internal sealed class GetFarmSettingsHandler(FarmingDbContext db) : IQueryHandler<GetFarmSettingsQuery, FarmSettingsDto>
{
    public async Task<Result<FarmSettingsDto>> Handle(GetFarmSettingsQuery q, CancellationToken ct)
    {
        var s = await Fm.SettingsAsync(db, ct);
        return Result.Success(new FarmSettingsDto(s.Types, s.MilkUnit ?? "L"));
    }
}

internal sealed class UpdateFarmSettingsHandler(FarmingDbContext db) : ICommandHandler<UpdateFarmSettingsCommand, FarmSettingsDto>
{
    public async Task<Result<FarmSettingsDto>> Handle(UpdateFarmSettingsCommand c, CancellationToken ct)
    {
        var types = c.EnabledTypes.Where(FarmTypes.All.Contains).Distinct().ToList();
        if (types.Count == 0) return Result.Failure<FarmSettingsDto>(Fm.Invalid("Keep at least one type of farming switched on."));
        var s = await Fm.SettingsAsync(db, ct);
        s.Update(types, c.MilkUnit);
        await db.SaveChangesAsync(ct);
        return Result.Success(new FarmSettingsDto(s.Types, s.MilkUnit ?? "L"));
    }
}

internal sealed class GetFarmsHandler(FarmingDbContext db) : IQueryHandler<GetFarmsQuery, IReadOnlyList<FarmDto>>
{
    public async Task<Result<IReadOnlyList<FarmDto>>> Handle(GetFarmsQuery q, CancellationToken ct)
    {
        var farms = await Fm.FarmsAsync(db, ct);
        var counts = await db.Units.Where(u => !u.IsDeleted).GroupBy(u => u.FarmId)
            .Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return Result.Success<IReadOnlyList<FarmDto>>(farms.Select(f => new FarmDto(f.Id, f.Name, f.Location, f.AreaAcres,
            f.Manager, f.Phone, f.Notes, counts.GetValueOrDefault(f.Id))).ToList());
    }
}

internal sealed class SaveFarmHandler(FarmingDbContext db) : ICommandHandler<SaveFarmCommand, FarmDto>
{
    public async Task<Result<FarmDto>> Handle(SaveFarmCommand c, CancellationToken ct)
    {
        Farm? f;
        if (c.Id is { } id)
        {
            f = await db.Farms.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (f is null) return Result.Failure<FarmDto>(Fm.NotFound("Farm"));
        }
        else { f = new Farm(c.Name); db.Farms.Add(f); }
        f.Update(c.Name, c.Location, c.AreaAcres, c.Manager, c.Phone, c.Notes);
        await db.SaveChangesAsync(ct);
        var n = await db.Units.CountAsync(u => u.FarmId == f.Id && !u.IsDeleted, ct);
        return Result.Success(new FarmDto(f.Id, f.Name, f.Location, f.AreaAcres, f.Manager, f.Phone, f.Notes, n));
    }
}

internal sealed class DeleteFarmHandler(FarmingDbContext db) : ICommandHandler<DeleteFarmCommand>
{
    public async Task<Result> Handle(DeleteFarmCommand c, CancellationToken ct)
    {
        var f = await db.Farms.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (f is null) return Result.Failure(Fm.NotFound("Farm"));
        if (await db.Units.AnyAsync(u => u.FarmId == f.Id && !u.IsDeleted, ct))
            return Result.Failure(Fm.Conflict("Farm", "Move or remove this farm's sheds, ponds and fields first."));
        if (await db.Farms.CountAsync(x => !x.IsDeleted, ct) <= 1)
            return Result.Failure(Fm.Conflict("Farm", "A workspace needs at least one farm."));
        f.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal static class UnitReader
{
    /// <summary>Head on each unit right now: active animals plus the live count of active batches.</summary>
    public static async Task<Dictionary<Guid, int>> HeadAsync(FarmingDbContext db, CancellationToken ct)
    {
        var head = await db.Animals.Where(a => !a.IsDeleted && a.Status == AnimalStatus.Active && a.UnitId != null)
            .GroupBy(a => a.UnitId!.Value).Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var batches = await BatchReader.LiveCountsAsync(db, activeOnly: true, ct);
        foreach (var b in batches.Where(b => b.UnitId != null))
            head[b.UnitId!.Value] = head.GetValueOrDefault(b.UnitId!.Value) + b.Current;
        return head;
    }
}

internal sealed class GetUnitsHandler(FarmingDbContext db) : IQueryHandler<GetUnitsQuery, IReadOnlyList<FarmUnitDto>>
{
    public async Task<Result<IReadOnlyList<FarmUnitDto>>> Handle(GetUnitsQuery q, CancellationToken ct)
    {
        var farms = (await Fm.FarmsAsync(db, ct)).ToDictionary(f => f.Id, f => f.Name);
        var units = db.Units.AsNoTracking().Where(u => !u.IsDeleted);
        if (q.FarmId is { } fid) units = units.Where(u => u.FarmId == fid);
        if (!string.IsNullOrWhiteSpace(q.Type)) units = units.Where(u => u.Type == q.Type);
        var list = await units.OrderBy(u => u.Name).ToListAsync(ct);
        var head = await UnitReader.HeadAsync(db, ct);
        return Result.Success<IReadOnlyList<FarmUnitDto>>(list.Select(u => new FarmUnitDto(u.Id, u.FarmId,
            farms.GetValueOrDefault(u.FarmId), u.Name, u.Type, u.Kind, u.Capacity, u.Notes, u.IsActive,
            head.GetValueOrDefault(u.Id))).ToList());
    }
}

internal sealed class SaveUnitHandler(FarmingDbContext db) : ICommandHandler<SaveUnitCommand, FarmUnitDto>
{
    public async Task<Result<FarmUnitDto>> Handle(SaveUnitCommand c, CancellationToken ct)
    {
        var farm = await db.Farms.FirstOrDefaultAsync(f => f.Id == c.FarmId && !f.IsDeleted, ct);
        if (farm is null) return Result.Failure<FarmUnitDto>(Fm.NotFound("Farm"));
        FarmUnit? u;
        if (c.Id is { } id)
        {
            u = await db.Units.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (u is null) return Result.Failure<FarmUnitDto>(Fm.NotFound("Unit"));
        }
        else { u = new FarmUnit(c.FarmId, c.Name, c.Type); db.Units.Add(u); }
        u.Update(c.FarmId, c.Name, c.Type, c.Kind, c.Capacity, c.Notes, c.IsActive);
        await db.SaveChangesAsync(ct);
        var head = await UnitReader.HeadAsync(db, ct);
        return Result.Success(new FarmUnitDto(u.Id, u.FarmId, farm.Name, u.Name, u.Type, u.Kind, u.Capacity, u.Notes,
            u.IsActive, head.GetValueOrDefault(u.Id)));
    }
}

internal sealed class DeleteUnitHandler(FarmingDbContext db) : ICommandHandler<DeleteUnitCommand>
{
    public async Task<Result> Handle(DeleteUnitCommand c, CancellationToken ct)
    {
        var u = await db.Units.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (u is null) return Result.Failure(Fm.NotFound("Unit"));
        if (await db.Animals.AnyAsync(a => a.UnitId == u.Id && !a.IsDeleted && a.Status == AnimalStatus.Active, ct) ||
            await db.Batches.AnyAsync(b => b.UnitId == u.Id && !b.IsDeleted && b.Status == "active", ct))
            return Result.Failure(Fm.Conflict("Unit", "Animals or an active batch are still here. Move them first."));
        u.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
