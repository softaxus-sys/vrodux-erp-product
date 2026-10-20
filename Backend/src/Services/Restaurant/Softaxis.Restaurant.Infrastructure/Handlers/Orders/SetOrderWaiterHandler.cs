using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class SetOrderWaiterHandler(RestaurantDbContext db, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<SetOrderWaiterCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(SetOrderWaiterCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(SetOrderWaiterCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders.Include(x => x.Items).Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        if (order.Status is "paid" or "cancelled")
            return Result.Failure<OrderDto>(Error.Custom("Order.Closed", "Cannot change the waiter on a closed order."));

        var waiter = cmd.Waiter.Trim();
        order.SetWaiter(waiter);

        // The floor plan shows the waiter from the table row, so it has to move with the order.
        if (order.TableId is { } tableId)
        {
            var table = await db.Tables.FirstOrDefaultAsync(x => x.Id == tableId && !x.IsDeleted, ct);
            if (table is not null && table.CurrentOrderId == order.Id) table.SetWaiter(waiter);
        }

        await db.SaveChangesAsync(ct);
        await realtime.NotifyTablesChangedAsync(ct);

        return Result.Success(OrderMappings.ToDto(order));
    }
}
