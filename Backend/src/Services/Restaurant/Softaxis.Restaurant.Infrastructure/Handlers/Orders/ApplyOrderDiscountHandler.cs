using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class ApplyOrderDiscountHandler(RestaurantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<ApplyOrderDiscountCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(ApplyOrderDiscountCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(ApplyOrderDiscountCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<OrderDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var o = await db.Orders.Include(x => x.Items).Include(x => x.Discounts)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (o is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));

        o.ApplyDiscount(cmd.Type, cmd.Amount, cmd.Reason, userId);
        // EF's change tracker marks a new child added only via navigation (Discounts.Add) as
        // Modified rather than Added — the discount's Id is already set (Guid.NewGuid() in its own
        // ctor) and it's reached from an already-tracked Order rather than via an explicit db.Add(),
        // so EF can't tell it's new. Without this, SaveChanges emits an UPDATE for a row that doesn't
        // exist yet and throws DbUpdateConcurrencyException on every single call, not just races.
        db.OrderDiscounts.Add(o.Discounts[^1]);
        await db.SaveChangesAsync(ct);

        return Result.Success(OrderMappings.ToDto(o));
    }
}
