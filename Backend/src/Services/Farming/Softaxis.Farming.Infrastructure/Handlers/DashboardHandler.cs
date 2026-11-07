using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Farming.Application;
using Softaxis.Farming.Domain.Entities;
using Softaxis.Farming.Infrastructure.Persistence;

namespace Softaxis.Farming.Infrastructure.Handlers;

internal sealed class GetFarmDashboardHandler(FarmingDbContext db) : IQueryHandler<GetFarmDashboardQuery, FarmDashboardDto>
{
    public async Task<Result<FarmDashboardDto>> Handle(GetFarmDashboardQuery q, CancellationToken ct)
    {
        var today = Fm.Today(q.Today);
        var from = Fm.Add(today, -29);
        var settings = await Fm.SettingsAsync(db, ct);

        var animals = await db.Animals.AsNoTracking().Where(a => !a.IsDeleted && a.Status == AnimalStatus.Active)
            .GroupBy(a => a.Type).Select(g => new { g.Key, N = g.Count() }).ToListAsync(ct);
        var live = await BatchReader.LiveCountsAsync(db, activeOnly: true, ct);

        var prod = await db.Production.AsNoTracking()
            .Where(p => !p.IsDeleted && string.Compare(p.Date, from) >= 0 && string.Compare(p.Date, today) <= 0)
            .Select(p => new { p.Date, p.Product, p.Uom, p.Quantity }).ToListAsync(ct);
        var totals = prod.GroupBy(p => (p.Product, p.Uom))
            .Select(g => new ProductTotal(g.Key.Product, g.Key.Uom, g.Where(p => p.Date == today).Sum(p => p.Quantity), g.Sum(p => p.Quantity)))
            .OrderByDescending(t => t.Last30Days).ToList();

        List<DailyPoint> Trend(string product) => Enumerable.Range(0, 30).Select(i => Fm.Add(from, i))
            .Select(d => new DailyPoint(d, prod.Where(p => p.Product == product && p.Date == d).Sum(p => p.Quantity))).ToList();

        var sales = await db.Sales.AsNoTracking().Where(s => !s.IsDeleted)
            .Select(s => new { s.Date, s.Quantity, s.UnitPrice, s.AmountPaid }).ToListAsync(ct);
        var sales30 = sales.Where(s => string.CompareOrdinal(s.Date, from) >= 0 && string.CompareOrdinal(s.Date, today) <= 0)
            .Sum(s => Math.Round(s.Quantity * s.UnitPrice, 2));
        var unpaid = sales.Sum(s => Math.Max(0, Math.Round(s.Quantity * s.UnitPrice, 2) - s.AmountPaid));

        var feed30 = await db.Feed.Where(f => !f.IsDeleted && string.Compare(f.Date, from) >= 0 && string.Compare(f.Date, today) <= 0)
            .SumAsync(f => (decimal?)f.Cost, ct) ?? 0;
        var health30 = await db.Health.Where(h => !h.IsDeleted && string.Compare(h.Date, from) >= 0 && string.Compare(h.Date, today) <= 0)
            .SumAsync(h => (decimal?)h.Cost, ct) ?? 0;
        var other30 = await db.Expenses.Where(e => !e.IsDeleted && string.Compare(e.Date, from) >= 0 && string.Compare(e.Date, today) <= 0)
            .SumAsync(e => (decimal?)e.Amount, ct) ?? 0;
        var deaths30 = await db.Mortality.Where(m => !m.IsDeleted && string.Compare(m.Date, from) >= 0 && string.Compare(m.Date, today) <= 0)
            .SumAsync(m => (int?)m.Count, ct) ?? 0;

        // What needs attention: overdue or near health follow-ups, births due, batches past their expected end.
        var alerts = new List<FarmAlert>();
        var soon = Fm.Add(today, 7);
        var tags = await Fm.AnimalTagsAsync(db, ct);
        var codes = await Fm.BatchCodesAsync(db, ct);
        var due = await db.Health.AsNoTracking().Where(h => !h.IsDeleted && h.NextDueOn != null && string.Compare(h.NextDueOn, soon) <= 0)
            .OrderBy(h => h.NextDueOn).Take(25).ToListAsync(ct);
        foreach (var h in due)
        {
            var who = h.AnimalId is { } a ? tags.GetValueOrDefault(a) : h.BatchId is { } b ? codes.GetValueOrDefault(b) : null;
            var late = string.CompareOrdinal(h.NextDueOn, today) < 0;
            alerts.Add(new FarmAlert(late ? "health_overdue" : "health_due", $"{h.Title} for {who ?? "the farm"} {(late ? "was due" : "is due")} {h.NextDueOn}", h.NextDueOn, h.AnimalId, h.BatchId));
        }
        var births = await db.Breeding.AsNoTracking().Where(b => b.Outcome == "pending" && b.ExpectedOn != null
            && string.Compare(b.ExpectedOn, Fm.Add(today, 14)) <= 0).OrderBy(b => b.ExpectedOn).Take(25).ToListAsync(ct);
        foreach (var b in births)
            alerts.Add(new FarmAlert("birth_due", $"{tags.GetValueOrDefault(b.AnimalId)} is expected to give birth {b.ExpectedOn}", b.ExpectedOn, b.AnimalId, null));
        var ending = await db.Batches.AsNoTracking().Where(b => !b.IsDeleted && b.Status == "active" && b.ExpectedEndDate != null
            && string.Compare(b.ExpectedEndDate, Fm.Add(today, 7)) <= 0).OrderBy(b => b.ExpectedEndDate).Take(25).ToListAsync(ct);
        foreach (var b in ending)
            alerts.Add(new FarmAlert("batch_ending", $"Batch {b.Code} is due to finish {b.ExpectedEndDate}", b.ExpectedEndDate, null, b.Id));

        return Result.Success(new FarmDashboardDto(
            settings.Types, animals.Sum(a => a.N), live.Count, live.Sum(l => l.Current),
            animals.Select(a => new NameValue(a.Key, a.N)).ToList(),
            live.GroupBy(l => l.Type).Select(g => new NameValue(g.Key, g.Sum(l => l.Current))).ToList(),
            totals, Trend(FarmProducts.Milk), Trend(FarmProducts.Eggs),
            sales30, unpaid, feed30, health30, other30, sales30 - feed30 - health30 - other30, deaths30,
            alerts.OrderBy(a => a.Date).ToList()));
    }
}
