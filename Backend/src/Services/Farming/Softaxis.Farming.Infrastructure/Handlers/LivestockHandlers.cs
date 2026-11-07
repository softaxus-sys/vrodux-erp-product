using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Farming.Application;
using Softaxis.Farming.Domain.Entities;
using Softaxis.Farming.Infrastructure.Persistence;

namespace Softaxis.Farming.Infrastructure.Handlers;

// ── Animals ─────────────────────────────────────────────────────────────────

internal static class AnimalReader
{
    public static async Task<List<AnimalDto>> BuildAsync(FarmingDbContext db, List<Animal> animals, string today, CancellationToken ct)
    {
        if (animals.Count == 0) return [];
        var ids = animals.Select(a => a.Id).ToList();
        var units = await Fm.UnitNamesAsync(db, ct);
        var tags = await Fm.AnimalTagsAsync(db, ct);
        var from = Fm.Add(today, -29);

        var weights = (await db.Weights.AsNoTracking().Where(w => w.AnimalId != null && ids.Contains(w.AnimalId!.Value))
                .ToListAsync(ct))
            .GroupBy(w => w.AnimalId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(w => w.Date).ThenByDescending(w => w.CreatedAt).First().WeightKg);
        var prod = await db.Production.AsNoTracking()
            .Where(p => !p.IsDeleted && p.AnimalId != null && ids.Contains(p.AnimalId!.Value) && string.Compare(p.Date, from) >= 0)
            .GroupBy(p => p.AnimalId!.Value).Select(g => new { g.Key, Q = g.Sum(p => p.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Q, ct);
        var pregnant = (await db.Breeding.AsNoTracking().Where(b => ids.Contains(b.AnimalId) && b.Outcome == "pending").ToListAsync(ct))
            .GroupBy(b => b.AnimalId).ToDictionary(g => g.Key, g => g.OrderByDescending(b => b.ServiceDate).First().ExpectedOn);
        var withdrawal = (await db.Health.AsNoTracking()
                .Where(h => !h.IsDeleted && h.AnimalId != null && ids.Contains(h.AnimalId!.Value) && h.WithdrawalDays > 0).ToListAsync(ct))
            .GroupBy(h => h.AnimalId!.Value)
            .ToDictionary(g => g.Key, g => g.Select(h => Fm.Add(h.Date, h.WithdrawalDays)).Max()!);

        return animals.Select(a =>
        {
            var w = withdrawal.GetValueOrDefault(a.Id);
            return new AnimalDto(a.Id, a.TagNumber, a.Name, a.Type, a.Species, a.Breed, a.Sex, a.BirthDate, a.UnitId,
                a.UnitId is { } u ? units.GetValueOrDefault(u) : null, a.DamId, a.DamId is { } d ? tags.GetValueOrDefault(d) : null,
                a.SireId, a.SireId is { } s ? tags.GetValueOrDefault(s) : null, a.Source, a.AcquiredOn, a.PurchasePrice,
                a.Status, a.StatusDate, a.StatusReason, a.Notes, weights.TryGetValue(a.Id, out var kg) ? kg : null,
                prod.GetValueOrDefault(a.Id), pregnant.GetValueOrDefault(a.Id),
                // Only an end date still ahead matters: milk/meat can be sold again after it.
                w is not null && string.CompareOrdinal(w, today) > 0 ? w : null);
        }).ToList();
    }
}

internal sealed class GetAnimalsHandler(FarmingDbContext db) : IQueryHandler<GetAnimalsQuery, IReadOnlyList<AnimalDto>>
{
    public async Task<Result<IReadOnlyList<AnimalDto>>> Handle(GetAnimalsQuery q, CancellationToken ct)
    {
        var a = db.Animals.AsNoTracking().Where(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Type)) a = a.Where(x => x.Type == q.Type);
        if (!string.IsNullOrWhiteSpace(q.Status)) a = a.Where(x => x.Status == q.Status);
        if (q.UnitId is { } u) a = a.Where(x => x.UnitId == u);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            a = a.Where(x => x.TagNumber.Contains(s) || (x.Name != null && x.Name.Contains(s)) || (x.Breed != null && x.Breed.Contains(s)));
        }
        var list = await a.OrderBy(x => x.TagNumber).Take(2000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<AnimalDto>>(await AnimalReader.BuildAsync(db, list, Fm.Today(q.Today), ct));
    }
}

internal sealed class GetAnimalHandler(FarmingDbContext db, ISender sender) : IQueryHandler<GetAnimalQuery, AnimalDetailDto>
{
    public async Task<Result<AnimalDetailDto>> Handle(GetAnimalQuery q, CancellationToken ct)
    {
        var a = await db.Animals.AsNoTracking().FirstOrDefaultAsync(x => x.Id == q.Id && !x.IsDeleted, ct);
        if (a is null) return Result.Failure<AnimalDetailDto>(Fm.NotFound("Animal"));
        var today = Fm.Today(q.Today);
        var dto = (await AnimalReader.BuildAsync(db, [a], today, ct))[0];
        var prod = await sender.Send(new GetProductionQuery(Fm.Add(today, -89), today, null, null, a.Id, null), ct);
        var health = await sender.Send(new GetHealthQuery(null, null, null, a.Id, null, false, today), ct);
        var breeding = await sender.Send(new GetBreedingQuery(a.Id, false), ct);
        var weights = await sender.Send(new GetWeightsQuery(a.Id, null), ct);
        var kids = await db.Animals.AsNoTracking().Where(x => !x.IsDeleted && (x.DamId == a.Id || x.SireId == a.Id))
            .OrderBy(x => x.BirthDate).ToListAsync(ct);
        return Result.Success(new AnimalDetailDto(dto, prod.Value, health.Value, breeding.Value, weights.Value,
            await AnimalReader.BuildAsync(db, kids, today, ct)));
    }
}

internal sealed class SaveAnimalHandler(FarmingDbContext db) : ICommandHandler<SaveAnimalCommand, AnimalDto>
{
    public async Task<Result<AnimalDto>> Handle(SaveAnimalCommand c, CancellationToken ct)
    {
        var tag = c.TagNumber.Trim();
        if (await db.Animals.AnyAsync(x => x.TagNumber == tag && !x.IsDeleted && x.Id != c.Id, ct))
            return Result.Failure<AnimalDto>(Error.Custom("Animal.Duplicate", $"Tag {tag} is already used by another animal."));
        if (await Fm.CheckLinksAsync(db, null, null, c.UnitId, ct) is { } err) return Result.Failure<AnimalDto>(err);
        foreach (var parent in new[] { c.DamId, c.SireId }.Where(p => p is not null))
        {
            if (parent == c.Id) return Result.Failure<AnimalDto>(Fm.Invalid("An animal cannot be its own parent."));
            if (!await db.Animals.AnyAsync(x => x.Id == parent && !x.IsDeleted, ct)) return Result.Failure<AnimalDto>(Fm.NotFound("Parent animal"));
        }
        Animal? a;
        if (c.Id is { } id)
        {
            a = await db.Animals.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (a is null) return Result.Failure<AnimalDto>(Fm.NotFound("Animal"));
        }
        else { a = new Animal(tag, c.Type); db.Animals.Add(a); }
        a.Update(tag, c.Name, c.Type, c.Species, c.Breed, c.Sex, c.BirthDate, c.UnitId, c.DamId, c.SireId, c.Source,
            c.AcquiredOn, c.PurchasePrice, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await AnimalReader.BuildAsync(db, [a], Fm.Today(null), ct))[0]);
    }
}

internal sealed class SetAnimalStatusHandler(FarmingDbContext db) : ICommandHandler<SetAnimalStatusCommand, AnimalDto>
{
    public async Task<Result<AnimalDto>> Handle(SetAnimalStatusCommand c, CancellationToken ct)
    {
        if (c.Status is not (AnimalStatus.Active or AnimalStatus.Culled))
            return Result.Failure<AnimalDto>(Fm.Invalid("Record a sale or a death to mark an animal sold or dead."));
        if (!Dates.ValidOrEmpty(c.Date)) return Result.Failure<AnimalDto>(Fm.Invalid("Use yyyy-MM-dd."));
        var a = await db.Animals.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (a is null) return Result.Failure<AnimalDto>(Fm.NotFound("Animal"));
        if (c.Status == AnimalStatus.Active && a.Status is AnimalStatus.Sold or AnimalStatus.Dead)
            return Result.Failure<AnimalDto>(Fm.Conflict("Animal", "Delete the sale or death record to bring this animal back."));
        a.SetStatus(c.Status, c.Status == AnimalStatus.Active ? null : c.Date ?? Fm.Today(null), c.Status == AnimalStatus.Active ? null : c.Reason);
        await db.SaveChangesAsync(ct);
        return Result.Success((await AnimalReader.BuildAsync(db, [a], Fm.Today(null), ct))[0]);
    }
}

internal sealed class DeleteAnimalHandler(FarmingDbContext db) : ICommandHandler<DeleteAnimalCommand>
{
    public async Task<Result> Handle(DeleteAnimalCommand c, CancellationToken ct)
    {
        var a = await db.Animals.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (a is null) return Result.Failure(Fm.NotFound("Animal"));
        if (await db.Sales.AnyAsync(s => s.AnimalId == a.Id && !s.IsDeleted, ct) ||
            await db.Production.AnyAsync(p => p.AnimalId == a.Id && !p.IsDeleted, ct))
            return Result.Failure(Fm.Conflict("Animal", "This animal has production or sales on record. Mark it culled instead."));
        a.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Batches ─────────────────────────────────────────────────────────────────

internal static class BatchReader
{
    public sealed record Live(Guid Id, Guid? UnitId, string Type, int Initial, int Deaths, int Sold)
    {
        public int Current => Math.Max(0, Initial - Deaths - Sold);
    }

    public static async Task<List<Live>> LiveCountsAsync(FarmingDbContext db, bool activeOnly, CancellationToken ct)
    {
        var batches = db.Batches.AsNoTracking().Where(b => !b.IsDeleted);
        if (activeOnly) batches = batches.Where(b => b.Status == "active");
        var list = await batches.Select(b => new { b.Id, b.UnitId, b.Type, b.InitialCount }).ToListAsync(ct);
        var deaths = await db.Mortality.AsNoTracking().Where(m => !m.IsDeleted && m.BatchId != null)
            .GroupBy(m => m.BatchId!.Value).Select(g => new { g.Key, N = g.Sum(m => m.Count) }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        var sold = await db.Sales.AsNoTracking().Where(s => !s.IsDeleted && s.BatchId != null)
            .GroupBy(s => s.BatchId!.Value).Select(g => new { g.Key, N = g.Sum(s => s.HeadCount) }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return list.Select(b => new Live(b.Id, b.UnitId, b.Type, b.InitialCount, deaths.GetValueOrDefault(b.Id), sold.GetValueOrDefault(b.Id))).ToList();
    }

    public static async Task<List<BatchDto>> BuildAsync(FarmingDbContext db, List<Batch> batches, string today, CancellationToken ct)
    {
        if (batches.Count == 0) return [];
        var ids = batches.Select(b => b.Id).ToList();
        var units = await Fm.UnitNamesAsync(db, ct);
        var live = (await LiveCountsAsync(db, false, ct)).ToDictionary(l => l.Id);
        var feed = await db.Feed.AsNoTracking().Where(f => !f.IsDeleted && f.BatchId != null && ids.Contains(f.BatchId!.Value))
            .GroupBy(f => f.BatchId!.Value).Select(g => new { g.Key, Q = g.Sum(f => f.Quantity), C = g.Sum(f => f.Cost) })
            .ToDictionaryAsync(x => x.Key, ct);
        var prod = await db.Production.AsNoTracking().Where(p => !p.IsDeleted && p.BatchId != null && ids.Contains(p.BatchId!.Value))
            .GroupBy(p => p.BatchId!.Value).Select(g => new { g.Key, Q = g.Sum(p => p.Quantity) }).ToDictionaryAsync(x => x.Key, x => x.Q, ct);
        var sales = await db.Sales.AsNoTracking().Where(s => !s.IsDeleted && s.BatchId != null && ids.Contains(s.BatchId!.Value))
            .Select(s => new { BatchId = s.BatchId!.Value, s.Quantity, s.UnitPrice }).ToListAsync(ct);
        var salesBy = sales.GroupBy(s => s.BatchId).ToDictionary(g => g.Key, g => g.Sum(s => Math.Round(s.Quantity * s.UnitPrice, 2)));
        var weights = (await db.Weights.AsNoTracking().Where(w => w.BatchId != null && ids.Contains(w.BatchId!.Value)).ToListAsync(ct))
            .GroupBy(w => w.BatchId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(w => w.Date).ThenByDescending(w => w.CreatedAt).First().WeightKg);

        return batches.Select(b =>
        {
            var l = live.GetValueOrDefault(b.Id) ?? new Live(b.Id, b.UnitId, b.Type, b.InitialCount, 0, 0);
            var f = feed.GetValueOrDefault(b.Id);
            var end = b.ClosedOn ?? today;
            var age = Math.Max(0, Fm.Days(b.StartDate, end));
            decimal? kg = weights.TryGetValue(b.Id, out var w) ? w : null;
            // Feed conversion ratio: feed eaten ÷ live weight gained. Meaningful for broilers and fish, so
            // only shown when both a weigh-in and feed in kilograms exist.
            decimal? fcr = kg is > 0 && l.Current > 0 && f is not null && f.Q > 0 ? Math.Round(f.Q / (kg.Value * l.Current), 2) : null;
            return new BatchDto(b.Id, b.Code, b.Type, b.Species, b.Breed, b.UnitId, b.UnitId is { } u ? units.GetValueOrDefault(u) : null,
                b.StartDate, b.InitialCount, l.Deaths, l.Sold, l.Current, b.Area, b.InitialCost, b.ExpectedEndDate, b.Status,
                b.ClosedOn, b.Notes, age, b.InitialCount > 0 ? Math.Round(100m * l.Deaths / b.InitialCount, 2) : 0,
                f?.Q ?? 0, f?.C ?? 0, prod.GetValueOrDefault(b.Id), kg, fcr, salesBy.GetValueOrDefault(b.Id));
        }).ToList();
    }
}

internal sealed class GetBatchesHandler(FarmingDbContext db) : IQueryHandler<GetBatchesQuery, IReadOnlyList<BatchDto>>
{
    public async Task<Result<IReadOnlyList<BatchDto>>> Handle(GetBatchesQuery q, CancellationToken ct)
    {
        var b = db.Batches.AsNoTracking().Where(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Type)) b = b.Where(x => x.Type == q.Type);
        if (!string.IsNullOrWhiteSpace(q.Status)) b = b.Where(x => x.Status == q.Status);
        var list = await b.OrderByDescending(x => x.StartDate).Take(1000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<BatchDto>>(await BatchReader.BuildAsync(db, list, Fm.Today(q.Today), ct));
    }
}

internal sealed class SaveBatchHandler(FarmingDbContext db) : ICommandHandler<SaveBatchCommand, BatchDto>
{
    public async Task<Result<BatchDto>> Handle(SaveBatchCommand c, CancellationToken ct)
    {
        var code = c.Code.Trim();
        if (await db.Batches.AnyAsync(x => x.Code == code && !x.IsDeleted && x.Id != c.Id, ct))
            return Result.Failure<BatchDto>(Error.Custom("Batch.Duplicate", $"A batch called {code} already exists."));
        if (await Fm.CheckLinksAsync(db, null, null, c.UnitId, ct) is { } err) return Result.Failure<BatchDto>(err);
        Batch? b;
        if (c.Id is { } id)
        {
            b = await db.Batches.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (b is null) return Result.Failure<BatchDto>(Fm.NotFound("Batch"));
            var live = (await BatchReader.LiveCountsAsync(db, false, ct)).First(l => l.Id == b.Id);
            if (c.InitialCount < live.Deaths + live.Sold)
                return Result.Failure<BatchDto>(Fm.Conflict("Batch",
                    $"{live.Deaths + live.Sold} have already died or been sold, so it cannot have started with fewer."));
        }
        else { b = new Batch(code, c.Type); db.Batches.Add(b); }
        b.Update(code, c.Type, c.Species, c.Breed, c.UnitId, c.StartDate, c.InitialCount, c.Area, c.InitialCost, c.ExpectedEndDate, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await BatchReader.BuildAsync(db, [b], Fm.Today(null), ct))[0]);
    }
}

internal sealed class CloseBatchHandler(FarmingDbContext db) : ICommandHandler<CloseBatchCommand, BatchDto>
{
    public async Task<Result<BatchDto>> Handle(CloseBatchCommand c, CancellationToken ct)
    {
        if (!Dates.ValidOrEmpty(c.On)) return Result.Failure<BatchDto>(Fm.Invalid("Use yyyy-MM-dd."));
        var b = await db.Batches.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure<BatchDto>(Fm.NotFound("Batch"));
        if (c.Reopen) b.Reopen();
        else
        {
            var on = c.On ?? Fm.Today(null);
            if (string.CompareOrdinal(on, b.StartDate) < 0) return Result.Failure<BatchDto>(Fm.Invalid("A batch cannot close before it started."));
            b.Close(on);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success((await BatchReader.BuildAsync(db, [b], Fm.Today(null), ct))[0]);
    }
}

internal sealed class DeleteBatchHandler(FarmingDbContext db) : ICommandHandler<DeleteBatchCommand>
{
    public async Task<Result> Handle(DeleteBatchCommand c, CancellationToken ct)
    {
        var b = await db.Batches.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (b is null) return Result.Failure(Fm.NotFound("Batch"));
        if (await db.Sales.AnyAsync(s => s.BatchId == b.Id && !s.IsDeleted, ct) ||
            await db.Production.AnyAsync(p => p.BatchId == b.Id && !p.IsDeleted, ct))
            return Result.Failure(Fm.Conflict("Batch", "This batch has production or sales on record. Close it instead."));
        b.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Breeding ────────────────────────────────────────────────────────────────

internal sealed class GetBreedingHandler(FarmingDbContext db) : IQueryHandler<GetBreedingQuery, IReadOnlyList<BreedingDto>>
{
    public async Task<Result<IReadOnlyList<BreedingDto>>> Handle(GetBreedingQuery q, CancellationToken ct)
    {
        var r = db.Breeding.AsNoTracking().AsQueryable();
        if (q.AnimalId is { } a) r = r.Where(x => x.AnimalId == a);
        if (q.PendingOnly) r = r.Where(x => x.Outcome == "pending");
        var list = await r.OrderByDescending(x => x.ServiceDate).Take(1000).ToListAsync(ct);
        var tags = await Fm.AnimalTagsAsync(db, ct);
        return Result.Success<IReadOnlyList<BreedingDto>>(list.Select(x => Map(x, tags)).ToList());
    }

    public static BreedingDto Map(BreedingRecord x, Dictionary<Guid, string> tags) => new(x.Id, x.AnimalId,
        tags.GetValueOrDefault(x.AnimalId), x.ServiceDate, x.Method, x.SireId, x.SireId is { } s ? tags.GetValueOrDefault(s) : null,
        x.SireNote, x.ExpectedOn, x.Outcome, x.OutcomeOn, x.Offspring, x.Notes);
}

internal sealed class SaveBreedingHandler(FarmingDbContext db) : ICommandHandler<SaveBreedingCommand, BreedingDto>
{
    public async Task<Result<BreedingDto>> Handle(SaveBreedingCommand c, CancellationToken ct)
    {
        var dam = await db.Animals.FirstOrDefaultAsync(x => x.Id == c.AnimalId && !x.IsDeleted, ct);
        if (dam is null) return Result.Failure<BreedingDto>(Fm.NotFound("Animal"));
        if (dam.Sex != "female") return Result.Failure<BreedingDto>(Fm.Invalid("Breeding is recorded on the female."));
        if (c.SireId is { } sid && !await db.Animals.AnyAsync(x => x.Id == sid && !x.IsDeleted && x.Sex == "male", ct))
            return Result.Failure<BreedingDto>(Fm.NotFound("Sire"));
        BreedingRecord? r;
        if (c.Id is { } id)
        {
            r = await db.Breeding.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (r is null) return Result.Failure<BreedingDto>(Fm.NotFound("Breeding"));
        }
        else
        {
            if (await db.Breeding.AnyAsync(x => x.AnimalId == dam.Id && x.Outcome == "pending", ct))
                return Result.Failure<BreedingDto>(Fm.Conflict("Breeding", "This animal already has a pending service. Record its outcome first."));
            r = new BreedingRecord(dam.Id); db.Breeding.Add(r);
        }
        var expected = c.ExpectedOn;
        if (string.IsNullOrWhiteSpace(expected) && FarmTypes.GestationDays(dam.Type, dam.Species) is > 0 and var days)
            expected = Fm.Add(c.ServiceDate, days);
        r.Update(c.ServiceDate, c.Method, c.SireId, c.SireNote, expected, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success(GetBreedingHandler.Map(r, await Fm.AnimalTagsAsync(db, ct)));
    }
}

internal sealed class RecordBreedingOutcomeHandler(FarmingDbContext db) : ICommandHandler<RecordBreedingOutcomeCommand, BreedingDto>
{
    public async Task<Result<BreedingDto>> Handle(RecordBreedingOutcomeCommand c, CancellationToken ct)
    {
        var r = await db.Breeding.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (r is null) return Result.Failure<BreedingDto>(Fm.NotFound("Breeding"));
        if (c.Outcome == "born" && c.Offspring < 1) return Result.Failure<BreedingDto>(Fm.Invalid("Enter how many were born."));
        r.RecordOutcome(c.Outcome, c.Outcome == "pending" ? null : c.On ?? Fm.Today(null), c.Outcome == "born" ? c.Offspring : 0);
        await db.SaveChangesAsync(ct);
        return Result.Success(GetBreedingHandler.Map(r, await Fm.AnimalTagsAsync(db, ct)));
    }
}

internal sealed class DeleteBreedingHandler(FarmingDbContext db) : ICommandHandler<DeleteBreedingCommand>
{
    public async Task<Result> Handle(DeleteBreedingCommand c, CancellationToken ct)
    {
        var r = await db.Breeding.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (r is null) return Result.Failure(Fm.NotFound("Breeding"));
        db.Breeding.Remove(r);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Weights ─────────────────────────────────────────────────────────────────

internal sealed class GetWeightsHandler(FarmingDbContext db) : IQueryHandler<GetWeightsQuery, IReadOnlyList<WeightDto>>
{
    public async Task<Result<IReadOnlyList<WeightDto>>> Handle(GetWeightsQuery q, CancellationToken ct)
    {
        var w = db.Weights.AsNoTracking().AsQueryable();
        if (q.AnimalId is { } a) w = w.Where(x => x.AnimalId == a);
        if (q.BatchId is { } b) w = w.Where(x => x.BatchId == b);
        var list = await w.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).Take(500).ToListAsync(ct);
        return Result.Success<IReadOnlyList<WeightDto>>(list.Select(Map).ToList());
    }

    public static WeightDto Map(WeightRecord x) => new(x.Id, x.Date, x.AnimalId, x.BatchId, x.WeightKg, x.SampleSize, x.Notes);
}

internal sealed class AddWeightHandler(FarmingDbContext db) : ICommandHandler<AddWeightCommand, WeightDto>
{
    public async Task<Result<WeightDto>> Handle(AddWeightCommand c, CancellationToken ct)
    {
        if (await Fm.CheckLinksAsync(db, c.AnimalId, c.BatchId, null, ct) is { } err) return Result.Failure<WeightDto>(err);
        var w = new WeightRecord(c.Date, c.AnimalId, c.BatchId, c.WeightKg, c.SampleSize, c.Notes);
        db.Weights.Add(w);
        await db.SaveChangesAsync(ct);
        return Result.Success(GetWeightsHandler.Map(w));
    }
}

internal sealed class DeleteWeightHandler(FarmingDbContext db) : ICommandHandler<DeleteWeightCommand>
{
    public async Task<Result> Handle(DeleteWeightCommand c, CancellationToken ct)
    {
        var w = await db.Weights.FirstOrDefaultAsync(x => x.Id == c.Id, ct);
        if (w is null) return Result.Failure(Fm.NotFound("Weight"));
        db.Weights.Remove(w);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
