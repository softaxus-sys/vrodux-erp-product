using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Farming.Application;
using Softaxis.Farming.Domain.Entities;
using Softaxis.Farming.Infrastructure.Persistence;

namespace Softaxis.Farming.Infrastructure.Handlers;

internal static class DateRange
{
    public static IQueryable<T> Between<T>(IQueryable<T> q, System.Linq.Expressions.Expression<Func<T, string>> date, string? from, string? to)
    {
        // Dates are yyyy-MM-dd strings, so ordinal comparison is date order.
        if (Dates.Valid(from))
        {
            var p = System.Linq.Expressions.Expression.Lambda<Func<T, bool>>(
                System.Linq.Expressions.Expression.GreaterThanOrEqual(
                    System.Linq.Expressions.Expression.Call(typeof(string).GetMethod(nameof(string.Compare), [typeof(string), typeof(string)])!,
                        date.Body, System.Linq.Expressions.Expression.Constant(from)),
                    System.Linq.Expressions.Expression.Constant(0)), date.Parameters);
            q = q.Where(p);
        }
        if (Dates.Valid(to))
        {
            var p = System.Linq.Expressions.Expression.Lambda<Func<T, bool>>(
                System.Linq.Expressions.Expression.LessThanOrEqual(
                    System.Linq.Expressions.Expression.Call(typeof(string).GetMethod(nameof(string.Compare), [typeof(string), typeof(string)])!,
                        date.Body, System.Linq.Expressions.Expression.Constant(to)),
                    System.Linq.Expressions.Expression.Constant(0)), date.Parameters);
            q = q.Where(p);
        }
        return q;
    }
}

// ── Production ──────────────────────────────────────────────────────────────

internal sealed class GetProductionHandler(FarmingDbContext db) : IQueryHandler<GetProductionQuery, IReadOnlyList<ProductionDto>>
{
    public async Task<Result<IReadOnlyList<ProductionDto>>> Handle(GetProductionQuery q, CancellationToken ct)
    {
        var p = DateRange.Between(db.Production.AsNoTracking().Where(x => !x.IsDeleted), x => x.Date, q.From, q.To);
        if (!string.IsNullOrWhiteSpace(q.Type)) p = p.Where(x => x.Type == q.Type);
        if (!string.IsNullOrWhiteSpace(q.Product)) p = p.Where(x => x.Product == q.Product);
        if (q.AnimalId is { } a) p = p.Where(x => x.AnimalId == a);
        if (q.BatchId is { } b) p = p.Where(x => x.BatchId == b);
        var list = await p.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).Take(3000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ProductionDto>>(await MapAsync(db, list, ct));
    }

    public static async Task<List<ProductionDto>> MapAsync(FarmingDbContext db, List<ProductionRecord> list, CancellationToken ct)
    {
        var tags = await Fm.AnimalTagsAsync(db, ct); var codes = await Fm.BatchCodesAsync(db, ct); var units = await Fm.UnitNamesAsync(db, ct);
        return list.Select(x => new ProductionDto(x.Id, x.Date, x.Type, x.Product, x.Quantity, x.Uom, x.Session, x.Grade, x.Rejected,
            x.AnimalId, x.AnimalId is { } a ? tags.GetValueOrDefault(a) : null, x.BatchId, x.BatchId is { } b ? codes.GetValueOrDefault(b) : null,
            x.UnitId, x.UnitId is { } u ? units.GetValueOrDefault(u) : null, x.Notes, x.RecordedByName)).ToList();
    }
}

internal sealed class SaveProductionHandler(FarmingDbContext db, ICurrentUser user) : ICommandHandler<SaveProductionCommand, ProductionDto>
{
    public async Task<Result<ProductionDto>> Handle(SaveProductionCommand c, CancellationToken ct)
    {
        if (await Fm.CheckLinksAsync(db, c.AnimalId, c.BatchId, c.UnitId, ct) is { } err) return Result.Failure<ProductionDto>(err);
        ProductionRecord? r;
        if (c.Id is { } id)
        {
            r = await db.Production.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (r is null) return Result.Failure<ProductionDto>(Fm.NotFound("Production"));
        }
        else { r = new ProductionRecord(user.Name); db.Production.Add(r); }
        r.Update(c.Date, c.Type, c.Product, c.Quantity, c.Uom, c.Session, c.Grade, c.Rejected, c.AnimalId, c.BatchId, c.UnitId, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await GetProductionHandler.MapAsync(db, [r], ct))[0]);
    }
}

internal sealed class BulkProductionHandler(FarmingDbContext db, ICurrentUser user) : ICommandHandler<BulkProductionCommand, int>
{
    public async Task<Result<int>> Handle(BulkProductionCommand c, CancellationToken ct)
    {
        var entries = c.Entries.Where(e => e.Quantity > 0).GroupBy(e => e.AnimalId).Select(g => g.Last()).ToList();
        if (entries.Count == 0) return Result.Failure<int>(Fm.Invalid("Enter a quantity for at least one animal."));
        var ids = entries.Select(e => e.AnimalId).ToList();
        var animals = await db.Animals.Where(a => ids.Contains(a.Id) && !a.IsDeleted).ToDictionaryAsync(a => a.Id, ct);
        if (animals.Count != ids.Count) return Result.Failure<int>(Fm.NotFound("Animal"));

        // Re-entering the same milking replaces it rather than doubling the figure.
        var existing = await db.Production.Where(p => !p.IsDeleted && p.Date == c.Date && p.Product == c.Product
            && p.Session == c.Session && p.AnimalId != null && ids.Contains(p.AnimalId!.Value)).ToListAsync(ct);
        foreach (var e in entries)
        {
            var a = animals[e.AnimalId];
            var r = existing.FirstOrDefault(p => p.AnimalId == a.Id);
            if (r is null) { r = new ProductionRecord(user.Name); db.Production.Add(r); }
            r.Update(c.Date, a.Type, c.Product, e.Quantity, c.Uom, c.Session, null, 0, a.Id, null, a.UnitId, r.Notes);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(entries.Count);
    }
}

internal sealed class DeleteProductionHandler(FarmingDbContext db) : ICommandHandler<DeleteProductionCommand>
{
    public async Task<Result> Handle(DeleteProductionCommand c, CancellationToken ct)
    {
        var r = await db.Production.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (r is null) return Result.Failure(Fm.NotFound("Production"));
        r.Delete(); await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Feed ────────────────────────────────────────────────────────────────────

internal sealed class GetFeedHandler(FarmingDbContext db) : IQueryHandler<GetFeedQuery, IReadOnlyList<FeedDto>>
{
    public async Task<Result<IReadOnlyList<FeedDto>>> Handle(GetFeedQuery q, CancellationToken ct)
    {
        var f = DateRange.Between(db.Feed.AsNoTracking().Where(x => !x.IsDeleted), x => x.Date, q.From, q.To);
        if (q.BatchId is { } b) f = f.Where(x => x.BatchId == b);
        if (q.UnitId is { } u) f = f.Where(x => x.UnitId == u);
        var list = await f.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).Take(3000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<FeedDto>>(await MapAsync(db, list, ct));
    }

    public static async Task<List<FeedDto>> MapAsync(FarmingDbContext db, List<FeedRecord> list, CancellationToken ct)
    {
        var tags = await Fm.AnimalTagsAsync(db, ct); var codes = await Fm.BatchCodesAsync(db, ct); var units = await Fm.UnitNamesAsync(db, ct);
        return list.Select(x => new FeedDto(x.Id, x.Date, x.FeedName, x.Quantity, x.Uom, x.Cost, x.AnimalId,
            x.AnimalId is { } a ? tags.GetValueOrDefault(a) : null, x.BatchId, x.BatchId is { } b ? codes.GetValueOrDefault(b) : null,
            x.UnitId, x.UnitId is { } u ? units.GetValueOrDefault(u) : null, x.Notes)).ToList();
    }
}

internal sealed class SaveFeedHandler(FarmingDbContext db, ICurrentUser user) : ICommandHandler<SaveFeedCommand, FeedDto>
{
    public async Task<Result<FeedDto>> Handle(SaveFeedCommand c, CancellationToken ct)
    {
        if (await Fm.CheckLinksAsync(db, c.AnimalId, c.BatchId, c.UnitId, ct) is { } err) return Result.Failure<FeedDto>(err);
        FeedRecord? r;
        if (c.Id is { } id)
        {
            r = await db.Feed.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (r is null) return Result.Failure<FeedDto>(Fm.NotFound("Feed"));
        }
        else { r = new FeedRecord(user.Name); db.Feed.Add(r); }
        r.Update(c.Date, c.FeedName, c.Quantity, c.Uom, c.Cost, c.AnimalId, c.BatchId, c.UnitId, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await GetFeedHandler.MapAsync(db, [r], ct))[0]);
    }
}

internal sealed class DeleteFeedHandler(FarmingDbContext db) : ICommandHandler<DeleteFeedCommand>
{
    public async Task<Result> Handle(DeleteFeedCommand c, CancellationToken ct)
    {
        var r = await db.Feed.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (r is null) return Result.Failure(Fm.NotFound("Feed"));
        r.Delete(); await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Health ──────────────────────────────────────────────────────────────────

internal sealed class GetHealthHandler(FarmingDbContext db) : IQueryHandler<GetHealthQuery, IReadOnlyList<HealthDto>>
{
    public async Task<Result<IReadOnlyList<HealthDto>>> Handle(GetHealthQuery q, CancellationToken ct)
    {
        var today = Fm.Today(q.Today);
        var h = db.Health.AsNoTracking().Where(x => !x.IsDeleted);
        if (q.DueOnly) h = h.Where(x => x.NextDueOn != null);
        else h = DateRange.Between(h, x => x.Date, q.From, q.To);
        if (!string.IsNullOrWhiteSpace(q.Kind)) h = h.Where(x => x.Kind == q.Kind);
        if (q.AnimalId is { } a) h = h.Where(x => x.AnimalId == a);
        if (q.BatchId is { } b) h = h.Where(x => x.BatchId == b);
        var list = q.DueOnly
            ? await h.OrderBy(x => x.NextDueOn).Take(2000).ToListAsync(ct)
            : await h.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).Take(3000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<HealthDto>>(await MapAsync(db, list, today, ct));
    }

    public static async Task<List<HealthDto>> MapAsync(FarmingDbContext db, List<HealthRecord> list, string today, CancellationToken ct)
    {
        var tags = await Fm.AnimalTagsAsync(db, ct); var codes = await Fm.BatchCodesAsync(db, ct);
        return list.Select(x => new HealthDto(x.Id, x.Date, x.Kind, x.Title, x.Medicine, x.Dose, x.VetName, x.Cost, x.NextDueOn,
            x.WithdrawalDays, x.WithdrawalDays > 0 ? Fm.Add(x.Date, x.WithdrawalDays) : null, x.AnimalId,
            x.AnimalId is { } a ? tags.GetValueOrDefault(a) : null, x.BatchId, x.BatchId is { } b ? codes.GetValueOrDefault(b) : null,
            x.Notes, x.NextDueOn != null && string.CompareOrdinal(x.NextDueOn, today) < 0)).ToList();
    }
}

internal sealed class SaveHealthHandler(FarmingDbContext db, ICurrentUser user) : ICommandHandler<SaveHealthCommand, HealthDto>
{
    public async Task<Result<HealthDto>> Handle(SaveHealthCommand c, CancellationToken ct)
    {
        if (await Fm.CheckLinksAsync(db, c.AnimalId, c.BatchId, null, ct) is { } err) return Result.Failure<HealthDto>(err);
        if (c.NextDueOn is { Length: > 0 } due && string.CompareOrdinal(due, c.Date) < 0)
            return Result.Failure<HealthDto>(Fm.Invalid("The next due date is before this record's date."));
        HealthRecord? r;
        if (c.Id is { } id)
        {
            r = await db.Health.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (r is null) return Result.Failure<HealthDto>(Fm.NotFound("Health"));
        }
        else { r = new HealthRecord(user.Name); db.Health.Add(r); }
        r.Update(c.Date, c.Kind, c.Title, c.Medicine, c.Dose, c.VetName, c.Cost, c.NextDueOn, c.WithdrawalDays, c.AnimalId, c.BatchId, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await GetHealthHandler.MapAsync(db, [r], Fm.Today(null), ct))[0]);
    }
}

internal sealed class ClearHealthDueHandler(FarmingDbContext db) : ICommandHandler<ClearHealthDueCommand>
{
    public async Task<Result> Handle(ClearHealthDueCommand c, CancellationToken ct)
    {
        var r = await db.Health.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (r is null) return Result.Failure(Fm.NotFound("Health"));
        r.ClearDue(); await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteHealthHandler(FarmingDbContext db) : ICommandHandler<DeleteHealthCommand>
{
    public async Task<Result> Handle(DeleteHealthCommand c, CancellationToken ct)
    {
        var r = await db.Health.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (r is null) return Result.Failure(Fm.NotFound("Health"));
        r.Delete(); await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Mortality ───────────────────────────────────────────────────────────────

internal sealed class GetMortalityHandler(FarmingDbContext db) : IQueryHandler<GetMortalityQuery, IReadOnlyList<MortalityDto>>
{
    public async Task<Result<IReadOnlyList<MortalityDto>>> Handle(GetMortalityQuery q, CancellationToken ct)
    {
        var m = DateRange.Between(db.Mortality.AsNoTracking().Where(x => !x.IsDeleted), x => x.Date, q.From, q.To);
        if (q.BatchId is { } b) m = m.Where(x => x.BatchId == b);
        var list = await m.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).Take(3000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<MortalityDto>>(await MapAsync(db, list, ct));
    }

    public static async Task<List<MortalityDto>> MapAsync(FarmingDbContext db, List<MortalityRecord> list, CancellationToken ct)
    {
        var tags = await Fm.AnimalTagsAsync(db, ct); var codes = await Fm.BatchCodesAsync(db, ct);
        return list.Select(x => new MortalityDto(x.Id, x.Date, x.AnimalId, x.AnimalId is { } a ? tags.GetValueOrDefault(a) : null,
            x.BatchId, x.BatchId is { } b ? codes.GetValueOrDefault(b) : null, x.Count, x.Cause, x.Notes, x.RecordedByName)).ToList();
    }
}

internal sealed class AddMortalityHandler(FarmingDbContext db, ICurrentUser user) : ICommandHandler<AddMortalityCommand, MortalityDto>
{
    public async Task<Result<MortalityDto>> Handle(AddMortalityCommand c, CancellationToken ct)
    {
        if (c.AnimalId is { } aid)
        {
            var a = await db.Animals.FirstOrDefaultAsync(x => x.Id == aid && !x.IsDeleted, ct);
            if (a is null) return Result.Failure<MortalityDto>(Fm.NotFound("Animal"));
            if (a.Status != AnimalStatus.Active) return Result.Failure<MortalityDto>(Fm.Conflict("Animal", $"{a.TagNumber} is already marked {a.Status}."));
            a.SetStatus(AnimalStatus.Dead, c.Date, c.Cause);
        }
        if (c.BatchId is { } bid)
        {
            var live = (await BatchReader.LiveCountsAsync(db, false, ct)).FirstOrDefault(l => l.Id == bid);
            if (live is null || !await db.Batches.AnyAsync(b => b.Id == bid && !b.IsDeleted, ct)) return Result.Failure<MortalityDto>(Fm.NotFound("Batch"));
            if (c.Count > live.Current)
                return Result.Failure<MortalityDto>(Fm.Conflict("Batch", $"The batch has only {live.Current} left."));
        }
        var r = new MortalityRecord(c.Date, c.AnimalId, c.BatchId, c.AnimalId is null ? c.Count : 1, c.Cause, c.Notes, user.Name);
        db.Mortality.Add(r);
        await db.SaveChangesAsync(ct);
        return Result.Success((await GetMortalityHandler.MapAsync(db, [r], ct))[0]);
    }
}

internal sealed class DeleteMortalityHandler(FarmingDbContext db) : ICommandHandler<DeleteMortalityCommand>
{
    public async Task<Result> Handle(DeleteMortalityCommand c, CancellationToken ct)
    {
        var r = await db.Mortality.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (r is null) return Result.Failure(Fm.NotFound("Mortality"));
        if (r.AnimalId is { } aid && await db.Animals.FirstOrDefaultAsync(a => a.Id == aid, ct) is { Status: AnimalStatus.Dead } a)
            a.SetStatus(AnimalStatus.Active, null, null);
        r.Delete(); await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Sales ───────────────────────────────────────────────────────────────────

internal sealed class GetSalesHandler(FarmingDbContext db) : IQueryHandler<GetSalesQuery, IReadOnlyList<SaleDto>>
{
    public async Task<Result<IReadOnlyList<SaleDto>>> Handle(GetSalesQuery q, CancellationToken ct)
    {
        var s = DateRange.Between(db.Sales.AsNoTracking().Where(x => !x.IsDeleted), x => x.Date, q.From, q.To);
        if (!string.IsNullOrWhiteSpace(q.Type)) s = s.Where(x => x.Type == q.Type);
        if (!string.IsNullOrWhiteSpace(q.Product)) s = s.Where(x => x.Product == q.Product);
        var list = await s.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).Take(3000).ToListAsync(ct);
        var rows = await MapAsync(db, list, ct);
        return Result.Success<IReadOnlyList<SaleDto>>(q.UnpaidOnly ? rows.Where(r => r.Balance > 0).ToList() : rows);
    }

    public static async Task<List<SaleDto>> MapAsync(FarmingDbContext db, List<FarmSale> list, CancellationToken ct)
    {
        var tags = await Fm.AnimalTagsAsync(db, ct); var codes = await Fm.BatchCodesAsync(db, ct);
        return list.Select(x => new SaleDto(x.Id, x.Date, x.Type, x.Product, x.Buyer, x.BuyerPhone, x.Quantity, x.Uom, x.UnitPrice,
            x.Total, x.AmountPaid, x.Balance, x.AnimalId, x.AnimalId is { } a ? tags.GetValueOrDefault(a) : null, x.BatchId,
            x.BatchId is { } b ? codes.GetValueOrDefault(b) : null, x.HeadCount, x.Notes)).ToList();
    }
}

internal sealed class SaveSaleHandler(FarmingDbContext db, ICurrentUser user) : ICommandHandler<SaveSaleCommand, SaleDto>
{
    public async Task<Result<SaleDto>> Handle(SaveSaleCommand c, CancellationToken ct)
    {
        if (c.AnimalId is not null && c.BatchId is not null)
            return Result.Failure<SaleDto>(Fm.Invalid("A sale is for one animal or one batch, not both."));
        FarmSale? s = null;
        if (c.Id is { } id)
        {
            s = await db.Sales.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (s is null) return Result.Failure<SaleDto>(Fm.NotFound("Sale"));
        }

        // Live animal sold: it leaves the herd. Produce from an animal (milk) does not change its status.
        var liveAnimal = c.AnimalId is not null && c.Product is FarmProducts.Animals or FarmProducts.Meat;
        if (c.AnimalId is { } aid)
        {
            var a = await db.Animals.FirstOrDefaultAsync(x => x.Id == aid && !x.IsDeleted, ct);
            if (a is null) return Result.Failure<SaleDto>(Fm.NotFound("Animal"));
            if (liveAnimal)
            {
                var alreadyThis = s?.AnimalId == aid && a.Status == AnimalStatus.Sold;
                if (a.Status != AnimalStatus.Active && !alreadyThis)
                    return Result.Failure<SaleDto>(Fm.Conflict("Animal", $"{a.TagNumber} is already marked {a.Status}."));
                a.SetStatus(AnimalStatus.Sold, c.Date, c.Buyer is null ? null : $"Sold to {c.Buyer}");
            }
        }
        // Moving the sale off an animal that it had sold brings that animal back.
        if (s?.AnimalId is { } oldA && oldA != c.AnimalId && await db.Animals.FirstOrDefaultAsync(a => a.Id == oldA, ct) is { Status: AnimalStatus.Sold } prev)
            prev.SetStatus(AnimalStatus.Active, null, null);

        if (c.BatchId is { } bid)
        {
            if (!await db.Batches.AnyAsync(b => b.Id == bid && !b.IsDeleted, ct)) return Result.Failure<SaleDto>(Fm.NotFound("Batch"));
            var live = (await BatchReader.LiveCountsAsync(db, false, ct)).First(l => l.Id == bid);
            var available = live.Current + (s?.BatchId == bid ? s.HeadCount : 0);
            if (c.HeadCount > available) return Result.Failure<SaleDto>(Fm.Conflict("Batch", $"The batch has only {available} left."));
        }

        if (s is null) { s = new FarmSale(user.Name); db.Sales.Add(s); }
        s.Update(c.Date, c.Type, c.Product, c.Buyer, c.BuyerPhone, c.Quantity, c.Uom, c.UnitPrice, c.AmountPaid, c.AnimalId,
            c.BatchId, c.BatchId is null ? 0 : c.HeadCount, c.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success((await GetSalesHandler.MapAsync(db, [s], ct))[0]);
    }
}

internal sealed class DeleteSaleHandler(FarmingDbContext db) : ICommandHandler<DeleteSaleCommand>
{
    public async Task<Result> Handle(DeleteSaleCommand c, CancellationToken ct)
    {
        var s = await db.Sales.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (s is null) return Result.Failure(Fm.NotFound("Sale"));
        if (s.AnimalId is { } aid && s.Product is FarmProducts.Animals or FarmProducts.Meat
            && await db.Animals.FirstOrDefaultAsync(a => a.Id == aid, ct) is { Status: AnimalStatus.Sold } a)
            a.SetStatus(AnimalStatus.Active, null, null);
        s.Delete(); await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Expenses ────────────────────────────────────────────────────────────────

internal sealed class GetExpensesHandler(FarmingDbContext db) : IQueryHandler<GetExpensesQuery, IReadOnlyList<ExpenseDto>>
{
    public async Task<Result<IReadOnlyList<ExpenseDto>>> Handle(GetExpensesQuery q, CancellationToken ct)
    {
        var e = DateRange.Between(db.Expenses.AsNoTracking().Where(x => !x.IsDeleted), x => x.Date, q.From, q.To);
        if (!string.IsNullOrWhiteSpace(q.Category)) e = e.Where(x => x.Category == q.Category);
        var list = await e.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).Take(3000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ExpenseDto>>(await MapAsync(db, list, ct));
    }

    public static async Task<List<ExpenseDto>> MapAsync(FarmingDbContext db, List<FarmExpense> list, CancellationToken ct)
    {
        var codes = await Fm.BatchCodesAsync(db, ct); var units = await Fm.UnitNamesAsync(db, ct);
        return list.Select(x => new ExpenseDto(x.Id, x.Date, x.Category, x.Description, x.Amount, x.Type, x.UnitId,
            x.UnitId is { } u ? units.GetValueOrDefault(u) : null, x.BatchId, x.BatchId is { } b ? codes.GetValueOrDefault(b) : null,
            x.PaidTo)).ToList();
    }
}

internal sealed class SaveExpenseHandler(FarmingDbContext db, ICurrentUser user) : ICommandHandler<SaveExpenseCommand, ExpenseDto>
{
    public async Task<Result<ExpenseDto>> Handle(SaveExpenseCommand c, CancellationToken ct)
    {
        if (await Fm.CheckLinksAsync(db, null, c.BatchId, c.UnitId, ct) is { } err) return Result.Failure<ExpenseDto>(err);
        FarmExpense? e;
        if (c.Id is { } id)
        {
            e = await db.Expenses.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (e is null) return Result.Failure<ExpenseDto>(Fm.NotFound("Expense"));
        }
        else { e = new FarmExpense(user.Name); db.Expenses.Add(e); }
        e.Update(c.Date, c.Category, c.Description, c.Amount, c.Type, c.UnitId, c.BatchId, c.PaidTo);
        await db.SaveChangesAsync(ct);
        return Result.Success((await GetExpensesHandler.MapAsync(db, [e], ct))[0]);
    }
}

internal sealed class DeleteExpenseHandler(FarmingDbContext db) : ICommandHandler<DeleteExpenseCommand>
{
    public async Task<Result> Handle(DeleteExpenseCommand c, CancellationToken ct)
    {
        var e = await db.Expenses.FirstOrDefaultAsync(x => x.Id == c.Id && !x.IsDeleted, ct);
        if (e is null) return Result.Failure(Fm.NotFound("Expense"));
        e.Delete(); await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
