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

        // Total is computed over Items, so the line sum is projected in SQL rather than
        // materialising every order with its lines.
        var monthly = await orders
            .Where(o => o.CreatedAt.Year == year)
            .GroupBy(o => o.CreatedAt.Month)
            .Select(g => new MonthlyPurchaseDto(
                g.Key,
                g.Sum(o => o.Items.Sum(i => i.Quantity * i.UnitCost * (1 + i.TaxRate / 100))),
                g.Count()))
            .ToListAsync(ct);

        // Cancelled orders are excluded from spend — nothing was bought.
        var vendors = await orders
            .Where(o => o.Status != "cancelled")
            .GroupBy(o => o.Vendor!.Name)
            .Select(g => new VendorSpendDto(
                g.Key,
                g.Sum(o => o.Items.Sum(i => i.Quantity * i.UnitCost * (1 + i.TaxRate / 100))),
                g.Count()))
            .OrderByDescending(v => v.Amount)
            .Take(TopVendors)
            .ToListAsync(ct);

        return Result.Success(new PurchaseDashboardDto(
            monthly.OrderBy(m => m.Month).ToList(), vendors));
    }
}
