using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.Dashboard.Dtos;
using Softaxis.Sales.Application.Dashboard.Queries;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.Dashboard;

internal sealed class GetSalesDashboardHandler(SalesDbContext db)
    : IQueryHandler<GetSalesDashboardQuery, SalesDashboardDto>
{
    public async Task<Result<SalesDashboardDto>> Handle(GetSalesDashboardQuery query, CancellationToken ct)
    {
        var year = query.Year ?? DateTime.UtcNow.Year;

        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual.
        var orders = db.SalesOrders.AsNoTracking().Where(o => !o.IsDeleted);

        // Total is a computed property over Items, so the line sum is projected in SQL rather than
        // materialising every order with its lines (the same approach the VAT ledger takes).
        var monthly = await orders
            .Where(o => o.CreatedAt.Year == year)
            .GroupBy(o => o.CreatedAt.Month)
            .Select(g => new MonthlyOrderDto(
                g.Key,
                g.Sum(o => o.Items.Sum(i => i.Quantity * i.UnitPrice * (1 - i.DiscountPercent / 100)
                                          * (1 + i.TaxRate / 100))),
                g.Count()))
            .ToListAsync(ct);

        var byStatus = await orders
            .GroupBy(o => o.Status)
            .Select(g => new OrderStatusCountDto(g.Key, g.Count()))
            .ToListAsync(ct);

        return Result.Success(new SalesDashboardDto(
            monthly.OrderBy(m => m.Month).ToList(),
            byStatus.OrderByDescending(s => s.Count).ToList()));
    }
}
