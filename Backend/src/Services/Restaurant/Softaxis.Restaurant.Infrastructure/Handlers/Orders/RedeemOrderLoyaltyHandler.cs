using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class RedeemOrderLoyaltyHandler(RestaurantDbContext db, POSDbContext posDb, ICurrentUser currentUser)
    : ICommandHandler<RedeemOrderLoyaltyCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(RedeemOrderLoyaltyCommand cmd, CancellationToken ct)
    {
        static Result<OrderDto> Refuse(string message) =>
            Result.Failure<OrderDto>(Error.Custom("Order.Conflict", message));

        if (currentUser.Id is not { } userId)
            return Result.Failure<OrderDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var pre = await db.Orders.AsNoTracking().Include(o => o.Discounts)
            .FirstOrDefaultAsync(o => o.Id == cmd.OrderId && !o.IsDeleted, ct);
        if (pre is null) return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        if (pre.Status is "paid" or "cancelled" or "split" or "held") return Refuse("This order can no longer be changed.");
        if (pre.CustomerId is not { } customerId) return Refuse("Link a customer to this order before using points.");
        if (cmd.Points * LoyaltySupport.PointValue > pre.SubTotal) return Refuse("That is more points than this bill is worth.");

        // Move only the difference, so swapping 50 points for 80 takes 30 — and a refusal changes nothing.
        var already = LoyaltySupport.ActivePoints(pre);
        var extra = cmd.Points - already;
        if (extra > 0)
        {
            var redeemed = await LoyaltySupport.RedeemAsync(posDb, customerId, extra, ct);
            if (redeemed.IsFailure) return Result.Failure<OrderDto>(redeemed.Error);
        }
        else if (extra < 0)
        {
            await LoyaltySupport.GiveAsync(posDb, customerId, -extra, ct);
        }

        return await ConcurrencyRetry.ExecuteAsync(db, async () =>
        {
            var o = await db.Orders.Include(x => x.Items).Include(x => x.Discounts)
                .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
            if (o is null) return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));

            if (cmd.Points == 0)
            {
                o.RemoveDiscount("Loyalty points taken off.", userId);
            }
            else
            {
                o.ApplyDiscount(LoyaltySupport.DiscountType, cmd.Points * LoyaltySupport.PointValue,
                    $"{cmd.Points:0} loyalty points", userId);
                db.OrderDiscounts.Add(o.Discounts[^1]);   // see ApplyOrderDiscountHandler
            }
            await db.SaveChangesAsync(ct);
            return Result.Success(OrderMappings.ToDto(o));
        });
    }
}
