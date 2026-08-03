using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class TransferOrderTableHandler(RestaurantDbContext db, ICurrentUser currentUser, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<TransferOrderTableCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(TransferOrderTableCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(TransferOrderTableCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<OrderDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var order = await db.Orders.Include(x => x.Items).Include(x => x.Payments)
            .Include(x => x.Discounts).Include(x => x.VoidLogs).Include(x => x.Refunds)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        if (order.Status is "paid" or "cancelled" or "split")
            return Result.Failure<OrderDto>(Error.Custom("Order.Closed", "Cannot transfer a closed order."));

        var fromTableId = order.TableId;
        var toTable = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.ToTableId && !x.IsDeleted, ct);
        if (toTable is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Table", cmd.ToTableId));
        if (toTable.IsMerged)
            return Result.Failure<OrderDto>(Error.Custom("Table.Conflict", "Cannot transfer an order onto a merged table."));
        if (toTable.Status == "occupied" && toTable.CurrentOrderId != order.Id)
            return Result.Failure<OrderDto>(Error.Custom("Table.Conflict", "The destination table already has an active order."));

        var fromTable = await db.Tables.FirstOrDefaultAsync(x => x.Id == fromTableId && !x.IsDeleted, ct);

        order.TransferTable(toTable.Id, toTable.TableNumber);
        db.TableTransferLogs.Add(new TableTransferLog(order.Id, fromTableId, toTable.Id, userId));

        if (fromTable is not null && fromTable.Id != toTable.Id)
            fromTable.Free();
        toTable.Occupy(order.Id, order.Waiter);

        await db.SaveChangesAsync(ct);
        await realtime.NotifyTablesChangedAsync(ct);
        return Result.Success(OrderMappings.ToDto(order));
    }
}
