using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Farming.Application;
using Softaxis.Farming.Domain.Entities;
using Softaxis.Farming.Infrastructure.Persistence;

namespace Softaxis.Farming.Infrastructure.Handlers;

/// <summary>Reports for the Reports hub: flat rows, each tied to the date it is filtered on.</summary>
internal sealed class RunFarmReportHandler(FarmingDbContext db) : IQueryHandler<RunFarmReportQuery, FarmReportResult>
{
    private const int Cap = 5000;
    private static Dictionary<string, object?> Row(params (string, object?)[] cells) => cells.ToDictionary(c => c.Item1, c => c.Item2);

    public async Task<Result<FarmReportResult>> Handle(RunFarmReportQuery q, CancellationToken ct)
    {
        var today = Fm.Today(q.Today);
        var to = Dates.Valid(q.To) ? q.To! : today;
        var from = Dates.Valid(q.From) ? q.From! : Fm.Add(to, -29);
        var id = q.ReportId.StartsWith("farming-") ? q.ReportId["farming-".Length..] : q.ReportId;
        var tags = await Fm.AnimalTagsAsync(db, ct);
        var codes = await Fm.BatchCodesAsync(db, ct);
        var units = await Fm.UnitNamesAsync(db, ct);
        string Source(Guid? a, Guid? b, Guid? u) =>
            a is { } x ? tags.GetValueOrDefault(x) ?? "" : b is { } y ? codes.GetValueOrDefault(y) ?? "" : u is { } z ? units.GetValueOrDefault(z) ?? "" : "";

        List<Dictionary<string, object?>> rows;
        switch (id)
        {
            case "production":
            {
                var list = await db.Production.AsNoTracking()
                    .Where(x => !x.IsDeleted && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0)
                    .OrderBy(x => x.Date).ThenBy(x => x.CreatedAt).Take(Cap).ToListAsync(ct);
                rows = list.Select(x => Row(("Date", x.Date), ("Farm type", x.Type), ("Product", x.Product), ("Quantity", x.Quantity), ("Unit", x.Uom),
                    ("Rejected", x.Rejected), ("From", Source(x.AnimalId, x.BatchId, x.UnitId)), ("Session", x.Session))).ToList();
                break;
            }
            case "production-by-product":
            {
                rows = (await db.Production.AsNoTracking()
                        .Where(x => !x.IsDeleted && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0)
                        .GroupBy(x => new { x.Product, x.Uom })
                        .Select(g => new { g.Key.Product, g.Key.Uom, N = g.Count(), Sum = g.Sum(x => x.Quantity), Rej = g.Sum(x => x.Rejected) }).ToListAsync(ct))
                    .OrderByDescending(x => x.Sum)
                    .Select(x => Row(("Product", x.Product), ("Unit", x.Uom), ("Records", x.N), ("Total", x.Sum), ("Rejected", x.Rej))).ToList();
                break;
            }
            case "milk-by-animal":
            {
                var span = Math.Max(1, Fm.Days(from, to) + 1);
                var groups = (await db.Production.AsNoTracking()
                        .Where(x => !x.IsDeleted && x.Product == FarmProducts.Milk && x.AnimalId != null
                            && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0).ToListAsync(ct))
                    .GroupBy(x => x.AnimalId!.Value);
                rows = groups.Select(g => new { Tag = tags.GetValueOrDefault(g.Key) ?? "", Total = g.Sum(r => r.Quantity), Days = g.Select(r => r.Date).Distinct().Count() })
                    .OrderByDescending(x => x.Total)
                    .Select(x => Row(("Animal", x.Tag), ("Total", x.Total), ("Days milked", x.Days),
                        ("Average per day milked", Math.Round(x.Total / Math.Max(1, x.Days), 2)), ("Average per day in range", Math.Round(x.Total / span, 2)))).ToList();
                break;
            }
            case "sales":
            {
                var list = await db.Sales.AsNoTracking()
                    .Where(x => !x.IsDeleted && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0)
                    .OrderBy(x => x.Date).ThenBy(x => x.CreatedAt).Take(Cap).ToListAsync(ct);
                rows = list.Select(x => Row(("Date", x.Date), ("Product", x.Product), ("Buyer", x.Buyer), ("Quantity", x.Quantity), ("Unit", x.Uom),
                    ("Price", x.UnitPrice), ("Total", x.Total), ("Paid", x.AmountPaid), ("Balance", x.Balance))).ToList();
                break;
            }
            case "receivables":
            {
                var list = (await db.Sales.AsNoTracking().Where(x => !x.IsDeleted).ToListAsync(ct))
                    .Where(x => x.Balance > 0).OrderBy(x => x.Date).Take(Cap).ToList();
                rows = list.Select(x => Row(("Buyer", x.Buyer ?? "Walk-in"), ("Phone", x.BuyerPhone), ("Date", x.Date), ("Product", x.Product), ("Total", x.Total),
                    ("Paid", x.AmountPaid), ("Balance", x.Balance), ("Days owed", Math.Max(0, Fm.Days(x.Date, today))))).ToList();
                break;
            }
            case "feed":
            {
                rows = (await db.Feed.AsNoTracking()
                        .Where(x => !x.IsDeleted && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0)
                        .GroupBy(x => new { x.FeedName, x.Uom })
                        .Select(g => new { g.Key.FeedName, g.Key.Uom, Qty = g.Sum(x => x.Quantity), Cost = g.Sum(x => x.Cost) }).ToListAsync(ct))
                    .OrderByDescending(x => x.Cost)
                    .Select(x => Row(("Feed", x.FeedName), ("Quantity", x.Qty), ("Unit", x.Uom), ("Cost", x.Cost),
                        ("Cost per unit", x.Qty > 0 ? Math.Round(x.Cost / x.Qty, 2) : null))).ToList();
                break;
            }
            case "batch-performance":
            {
                var batches = await db.Batches.AsNoTracking().Where(b => !b.IsDeleted).OrderByDescending(b => b.StartDate).Take(1000).ToListAsync(ct);
                var dtos = await BatchReader.BuildAsync(db, batches, today, ct);
                rows = dtos.Select(b => Row(("Batch", b.Code), ("Type", b.Type), ("Status", b.Status), ("Started", b.StartDate), ("Age (days)", b.AgeDays),
                    ("Started with", b.InitialCount), ("Deaths", b.Deaths), ("Mortality %", b.MortalityPct), ("Sold", b.Sold), ("Now", b.CurrentCount),
                    ("Feed cost", b.FeedCost), ("Output", b.ProductionQty), ("Sales", b.SalesTotal), ("FCR", b.Fcr))).ToList();
                break;
            }
            case "health-due":
            {
                var list = await db.Health.AsNoTracking().Where(x => !x.IsDeleted && x.NextDueOn != null).OrderBy(x => x.NextDueOn).Take(Cap).ToListAsync(ct);
                rows = list.Select(x => Row(("Due", x.NextDueOn), ("What", x.Title), ("Kind", x.Kind), ("For", Source(x.AnimalId, x.BatchId, null)),
                    ("Last done", x.Date), ("Days overdue", string.CompareOrdinal(x.NextDueOn, today) < 0 ? Fm.Days(x.NextDueOn!, today) : 0))).ToList();
                break;
            }
            case "mortality":
            {
                var list = await db.Mortality.AsNoTracking()
                    .Where(x => !x.IsDeleted && string.Compare(x.Date, from) >= 0 && string.Compare(x.Date, to) <= 0)
                    .OrderBy(x => x.Date).Take(Cap).ToListAsync(ct);
                rows = list.Select(x => Row(("Date", x.Date), ("Animal / batch", Source(x.AnimalId, x.BatchId, null)), ("Count", x.Count), ("Cause", x.Cause))).ToList();
                break;
            }
            default:
                return Result.Failure<FarmReportResult>(Fm.NotFound("Report"));
        }
        return Result.Success(new FarmReportResult(rows, rows.Count));
    }
}
