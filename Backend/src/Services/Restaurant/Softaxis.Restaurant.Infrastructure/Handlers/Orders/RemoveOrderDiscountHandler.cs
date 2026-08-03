using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class RemoveOrderDiscountHandler(RestaurantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<RemoveOrderDiscountCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(RemoveOrderDiscountCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(RemoveOrderDiscountCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<OrderDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var o = await db.Orders.Include(x => x.Items).Include(x => x.Discounts)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (o is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));

        o.RemoveDiscount(cmd.Reason, userId);
        await db.SaveChangesAsync(ct);

        return Result.Success(OrderMappings.ToDto(o));
    }
}
