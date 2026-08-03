using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Application.Orders.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class GetOrdersSummaryHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetOrdersSummaryQuery, OrdersSummaryDto>
{
    public async Task<Result<OrdersSummaryDto>> Handle(GetOrdersSummaryQuery query, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var all = await BranchScope.Apply(db.Orders.AsNoTracking().Where(x => !x.IsDeleted), accessible)
            .Select(x => new { x.Status, x.Total, x.TipAmount, x.OrderType, x.CreatedAt }).ToListAsync(ct);
        var todayOrders = all.Where(x => x.CreatedAt >= today).ToList();

        var dto = new OrdersSummaryDto(
            Total: all.Count,
            Open: all.Count(x => x.Status == "open"),
            Sent: all.Count(x => x.Status == "sent"),
            Ready: all.Count(x => x.Status == "ready"),
            Served: all.Count(x => x.Status == "served"),
            Paid: all.Count(x => x.Status == "paid"),
            Cancelled: all.Count(x => x.Status == "cancelled"),
            Split: all.Count(x => x.Status == "split"),
            Held: all.Count(x => x.Status == "held"),
            TodayOrders: todayOrders.Count,
            TodayRevenue: todayOrders.Where(x => x.Status == "paid").Sum(x => x.Total),
            TotalRevenue: all.Where(x => x.Status == "paid").Sum(x => x.Total),
            TotalTips: all.Where(x => x.Status == "paid").Sum(x => x.TipAmount));

        return Result.Success(dto);
    }
}
