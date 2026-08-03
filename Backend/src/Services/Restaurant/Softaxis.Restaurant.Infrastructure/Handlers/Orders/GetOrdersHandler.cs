using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Application.Orders.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class GetOrdersHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetOrdersQuery, IReadOnlyList<OrderDto>>
{
    public async Task<Result<IReadOnlyList<OrderDto>>> Handle(GetOrdersQuery query, CancellationToken ct)
    {
        // Payments intentionally not included here (matches the pre-migration behaviour) — the list
        // view never showed a payment breakdown, only GetOrderById does. Kept as-is to avoid an
        // unrelated behaviour change; each order's `payments` will render empty in this endpoint.
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var q = BranchScope.Apply(db.Orders.AsNoTracking().Include(x => x.Items).ThenInclude(i => i.SelectedModifiers)
            .Where(x => !x.IsDeleted), accessible);
        if (!string.IsNullOrEmpty(query.Status)) q = q.Where(x => x.Status == query.Status);

        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<OrderDto>>(items.Select(OrderMappings.ToDto).ToList());
    }
}
