using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Purchase.Application.Dashboard.Dtos;
using Softaxis.Purchase.Application.Dashboard.Queries;
using Softaxis.Purchase.Infrastructure.Persistence;

namespace Softaxis.Purchase.Infrastructure.Handlers.Dashboard;

internal sealed class GetPurchaseDashboardHandler(PurchaseDbContext db)
    : IQueryHandler<GetPurchaseDashboardQuery, PurchaseDashboardDto>
{
    /// <summary>The chart has room for five bars.</summary>
    private const int TopVendors = 5;

    public async Task<Result<PurchaseDashboardDto>> Handle(GetPurchaseDashboardQuery query, CancellationToken ct)
    {
        var year = query.Year ?? DateTime.UtcNow.Year;

        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual.
        var orders = db.PurchaseOrders.AsNoTracking().Where(o => !o.IsDeleted);

        // An aggregate over a collection navigation nested inside a GroupBy aggregate cannot be
        // translated, so the line sums are taken over the flattened order/item pairs and the order
        // counts come from a second query — flattening would both drop item-less orders and
        // multiply the rest by their line count.
        var thisYear = orders.Where(o => o.CreatedAt.Year == year);

        var monthlyAmounts = await thisYear
            .SelectMany(o => o.Items, (o, i) => new { o.CreatedAt.Month, Line = i.Quantity * i.UnitCost * (1 + i.TaxRate / 100) })
            .GroupBy(x => x.Month)
            .Select(g => new { Month = g.Key, Amount = g.Sum(x => x.Line) })
            .ToListAsync(ct);

        var monthlyCounts = await thisYear
            .GroupBy(o => o.CreatedAt.Month)
            .Select(g => new { Month = g.Key, Orders = g.Count() })
            .ToListAsync(ct);

        var amountByMonth = monthlyAmounts.ToDictionary(x => x.Month, x => x.Amount);
        var monthly = monthlyCounts
            .Select(c => new MonthlyPurchaseDto(c.Month, amountByMonth.GetValueOrDefault(c.Month), c.Orders))
            .OrderBy(m => m.Month)
            .ToList();

        // Cancelled orders are excluded from spend — nothing was bought.
        var active = orders.Where(o => o.Status != "cancelled");

        var vendorAmounts = await active
            .SelectMany(o => o.Items, (o, i) => new { Vendor = o.Vendor!.Name, Line = i.Quantity * i.UnitCost * (1 + i.TaxRate / 100) })
            .GroupBy(x => x.Vendor)
            .Select(g => new { Vendor = g.Key, Amount = g.Sum(x => x.Line) })
            .ToListAsync(ct);

        var vendorCounts = await active
            .GroupBy(o => o.Vendor!.Name)
            .Select(g => new { Vendor = g.Key, Orders = g.Count() })
            .ToListAsync(ct);

        var amountByVendor = vendorAmounts.ToDictionary(x => x.Vendor, x => x.Amount);
        var vendors = vendorCounts
            .Select(c => new VendorSpendDto(c.Vendor, amountByVendor.GetValueOrDefault(c.Vendor), c.Orders))
            .OrderByDescending(v => v.Amount)
            .Take(TopVendors)
            .ToList();

        return Result.Success(new PurchaseDashboardDto(monthly, vendors));
    }
}
