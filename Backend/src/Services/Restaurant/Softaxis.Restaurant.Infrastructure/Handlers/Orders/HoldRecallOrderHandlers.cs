using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class HoldOrderHandler(RestaurantDbContext db)
    : ICommandHandler<HoldOrderCommand, OrderStatusDto>
{
    public Task<Result<OrderStatusDto>> Handle(HoldOrderCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, async () =>
        {
            var o = await db.Orders.FindAsync([cmd.OrderId], ct);
            if (o is null || o.IsDeleted)
                return Result.Failure<OrderStatusDto>(Error.NotFoundById("Order", cmd.OrderId));
            if (o.Status != "open")
                return Result.Failure<OrderStatusDto>(Error.Custom("Order.Conflict", "Only open orders can be held."));

            o.Hold();
            await db.SaveChangesAsync(ct);
            return Result.Success(new OrderStatusDto(o.Id, o.Status));
        });
}

internal sealed class RecallOrderHandler(RestaurantDbContext db)
    : ICommandHandler<RecallOrderCommand, OrderStatusDto>
{
    public Task<Result<OrderStatusDto>> Handle(RecallOrderCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, async () =>
        {
            var o = await db.Orders.FindAsync([cmd.OrderId], ct);
            if (o is null || o.IsDeleted)
                return Result.Failure<OrderStatusDto>(Error.NotFoundById("Order", cmd.OrderId));
            if (o.Status != "held")
                return Result.Failure<OrderStatusDto>(Error.Custom("Order.Conflict", "Only held orders can be recalled."));

            o.Recall();
            await db.SaveChangesAsync(ct);
            return Result.Success(new OrderStatusDto(o.Id, o.Status));
        });
}
