using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Application.Orders.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

/// <summary>Tier-2 branch-access spot-check (see Module 5g's own "Tier 1 + one Tier 2 spot-check"
/// precedent) — 404 (not 403) for a branch-scoped user reading an order outside their branch(es), so
/// existence isn't leaked. The list/summary queries (Tier 1) already filter what a scoped user sees;
/// this closes the gap where a stale/guessed order id could otherwise still be fetched directly.</summary>
internal sealed class GetOrderByIdHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetOrderByIdQuery, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(GetOrderByIdQuery query, CancellationToken ct)
    {
        var o = await db.Orders.AsNoTracking()
            .Include(x => x.Items).ThenInclude(i => i.SelectedModifiers)
            .Include(x => x.Payments)
            .Include(x => x.Discounts).Include(x => x.VoidLogs).Include(x => x.Refunds)
            .FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);

        if (o is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", query.Id));

        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        if (accessible is not null && o.BranchId is not null && !accessible.Contains(o.BranchId.Value))
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", query.Id));

        var dto = OrderMappings.ToDto(o);

        // A split parent's children aren't a navigation on Order — look them up separately.
        // Outstanding is a computed (unmapped) property, so materialize first, then project in memory.
        if (!o.ParentOrderId.HasValue)
        {
            var children = await db.Orders.AsNoTracking()
                .Where(x => x.ParentOrderId == o.Id && !x.IsDeleted)
                .ToListAsync(ct);
            if (children.Count > 0)
            {
                var splits = children
                    .Select(x => new OrderSplitSummaryDto(x.Id, x.OrderNumber, x.Status, x.Total, x.AmountPaid, x.Outstanding))
                    .ToList();
                dto = dto with { Splits = splits };
            }
        }

        return Result.Success(dto);
    }
}
