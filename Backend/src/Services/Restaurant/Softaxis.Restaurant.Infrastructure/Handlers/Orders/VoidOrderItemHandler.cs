using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class VoidOrderItemHandler(RestaurantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<VoidOrderItemCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(VoidOrderItemCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(VoidOrderItemCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<OrderDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var order = await db.Orders.Include(x => x.Items).Include(x => x.VoidLogs).Include(x => x.Discounts)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        if (order.Status is "paid" or "cancelled" or "split" or "held")
            return Result.Failure<OrderDto>(Error.Custom("Order.Closed", "Cannot modify a closed order."));

        if (!order.VoidItem(cmd.ItemId, cmd.Reason, userId))
            return Result.Failure<OrderDto>(Error.NotFoundById("OrderItem", cmd.ItemId));

        // See ApplyOrderDiscountHandler — VoidItem() appends a new OrderVoidLog reachable only via
        // navigation from the already-tracked Order, which EF marks Modified instead of Added.
        db.OrderVoidLogs.Add(order.VoidLogs[^1]);
        await db.SaveChangesAsync(ct);

        return Result.Success(OrderMappings.ToDto(order));
    }
}
