using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class SplitOrderHandler(RestaurantDbContext db)
    : ICommandHandler<SplitOrderCommand, IReadOnlyList<OrderDto>>
{
    public Task<Result<IReadOnlyList<OrderDto>>> Handle(SplitOrderCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<IReadOnlyList<OrderDto>>> HandleOnce(SplitOrderCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders
            .Include(x => x.Items).Include(x => x.Payments).Include(x => x.Discounts)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null)
            return Result.Failure<IReadOnlyList<OrderDto>>(Error.NotFoundById("Order", cmd.OrderId));

        if (order.Status is "paid" or "cancelled" or "split" or "held")
            return Result.Failure<IReadOnlyList<OrderDto>>(
                Error.Custom("Order.Conflict", "This order cannot be split in its current state."));
        if (order.ParentOrderId.HasValue)
            return Result.Failure<IReadOnlyList<OrderDto>>(
                Error.Custom("Order.Conflict", "A split bill cannot itself be split."));
        if (order.Payments.Count > 0)
            return Result.Failure<IReadOnlyList<OrderDto>>(
                Error.Custom("Order.Conflict", "Cannot split an order that already has payments recorded."));
        if (order.Discounts.Any(d => !d.IsVoided))
            return Result.Failure<IReadOnlyList<OrderDto>>(
                Error.Custom("Order.Conflict", "Cannot split an order with an active discount — remove it first."));

        var activeItems = order.Items.Where(i => !i.IsDeleted).ToList();
        var allIds = cmd.Groups.SelectMany(g => g.ItemIds).ToList();
        var activeIdSet = activeItems.Select(i => i.Id).ToHashSet();
        if (allIds.Count != allIds.Distinct().Count() || !activeIdSet.SetEquals(allIds))
            return Result.Failure<IReadOnlyList<OrderDto>>(
                Error.Custom("Order.Conflict", "Every item on the order must be assigned to exactly one split group."));

        var children = new List<Domain.Entities.Order>();
        foreach (var group in cmd.Groups)
        {
            var groupItems = activeItems.Where(i => group.ItemIds.Contains(i.Id)).ToList();
            var child = order.CreateSplit(groupItems);
            db.Orders.Add(child);
            children.Add(child);
        }
        order.MarkSplit();

        await db.SaveChangesAsync(ct);

        return Result.Success<IReadOnlyList<OrderDto>>(children.Select(OrderMappings.ToDto).ToList());
    }
}
