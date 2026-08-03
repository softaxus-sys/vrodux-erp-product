using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class VoidOrderHandler(RestaurantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<VoidOrderCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(VoidOrderCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(VoidOrderCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<OrderDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var o = await db.Orders.Include(x => x.Items).Include(x => x.Payments)
            .Include(x => x.Discounts).Include(x => x.VoidLogs)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (o is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        // Pre-existing gap noticed while adding the split guard: this handler had no status check at
        // all, so an already-paid/cancelled order could be "voided" again. Split parents additionally
        // can't be cancelled directly — cancel each child instead, since the parent holds no items.
        if (o.Status is "paid" or "cancelled")
            return Result.Failure<OrderDto>(Error.Custom("Order.Closed", "Cannot modify a closed order."));
        if (o.Status == "split")
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict",
                "This order was split — cancel each part individually."));

        o.VoidWholeOrder(cmd.Reason, userId);
        await db.SaveChangesAsync(ct);

        return Result.Success(OrderMappings.ToDto(o));
    }
}
