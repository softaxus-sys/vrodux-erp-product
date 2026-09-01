using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Application.Orders.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class GetOrdersHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetOrdersQuery, PagedResult<OrderDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole trading history.</summary>
    private const int MaxPageSize = 200;

    /// <summary>An order is finished once it is paid or cancelled; everything else is still live.</summary>
    private static readonly string[] ClosedStatuses = ["paid", "cancelled"];

    public async Task<Result<PagedResult<OrderDto>>> Handle(GetOrdersQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // Payments intentionally not included here (matches the pre-migration behaviour) — the list
        // view never showed a payment breakdown, only GetOrderById does.
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var q = BranchScope.Apply(db.Orders.AsNoTracking()
            .Where(x => !x.IsDeleted), accessible);

        if (!string.IsNullOrEmpty(query.Status))
        {
            // "open" is the floor plan's filter: whatever is still live. Narrowing it in SQL is what
            // keeps that screen bounded by table count rather than by every order ever taken.
            q = query.Status == "open"
                ? q.Where(x => !ClosedStatuses.Contains(x.Status))
                : q.Where(x => x.Status == query.Status);
        }

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        // Include applied AFTER the filter and only around the page being returned, so the items and
        // modifiers of orders nobody asked for are never read.
        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)              // stable: a busy service writes many orders per second
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(x => x.Items).ThenInclude(i => i.SelectedModifiers)
            .ToListAsync(ct);

        return Result.Success(PagedResult<OrderDto>.Create(
            items.Select(OrderMappings.ToDto).ToList(), total, page, pageSize));
    }
}
