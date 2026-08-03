using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class SetOrderCustomerHandler(RestaurantDbContext db)
    : ICommandHandler<SetOrderCustomerCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(SetOrderCustomerCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(SetOrderCustomerCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders.Include(x => x.Items).Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        if (order.Status is "paid" or "cancelled" or "split" or "held")
            return Result.Failure<OrderDto>(Error.Custom("Order.Closed", "Cannot change the customer on this order right now."));

        order.SetCustomer(cmd.CustomerId);
        await db.SaveChangesAsync(ct);

        return Result.Success(OrderMappings.ToDto(order));
    }
}
