using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Loyalty points on restaurant orders. The points themselves live on the POS customer (one balance
/// whether they eat in or shop at the till), reached through POSDbContext the same way
/// <see cref="CustomerPaymentSupport"/> reaches the wallet. The rules mirror the retail till:
/// one point per <see cref="SpendPerPoint"/> spent, and a point is worth <see cref="PointValue"/>.
///
/// Like a wallet charge, a redemption is a real mutation and must run once, outside any
/// concurrency-retried block.
/// </summary>
internal static class LoyaltySupport
{
    public const string DiscountType = "loyalty";
    public const decimal SpendPerPoint = 100m;
    public const decimal PointValue = 1m;

    /// <summary>Points currently spent on this order — the active loyalty discount, if there is one.</summary>
    public static decimal ActivePoints(Order order) =>
        order.Discounts.Where(d => !d.IsVoided && d.Type == DiscountType).Sum(d => d.Amount) / PointValue;

    public static async Task<Result> RedeemAsync(POSDbContext posDb, Guid customerId, decimal points, CancellationToken ct)
    {
        var customer = await posDb.Customers.FirstOrDefaultAsync(c => c.Id == customerId, ct);
        if (customer is null) return Result.Failure(Error.NotFoundById("Customer", customerId));
        var redeemed = customer.RedeemLoyaltyPoints(points);
        if (redeemed.IsFailure)
            return Result.Failure(Error.Custom("Order.Conflict", redeemed.Error.Description));
        await posDb.SaveChangesAsync(ct);
        return Result.Success();
    }

    public static async Task GiveAsync(POSDbContext posDb, Guid customerId, decimal points, CancellationToken ct)
    {
        if (points <= 0) return;
        var customer = await posDb.Customers.FirstOrDefaultAsync(c => c.Id == customerId, ct);
        if (customer is null) return;
        customer.AddLoyaltyPoints(points);
        await posDb.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Puts back the points spent on an order whose discount is about to be removed or which is about
    /// to be cancelled. A paid order keeps them spent — the discount was used.
    /// </summary>
    public static async Task ReturnSpentPointsAsync(RestaurantDbContext db, POSDbContext posDb, Guid orderId, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Discounts)
            .FirstOrDefaultAsync(o => o.Id == orderId && !o.IsDeleted, ct);
        if (order?.CustomerId is not { } customerId || order.Status is "paid" or "cancelled" or "split") return;
        await GiveAsync(posDb, customerId, ActivePoints(order), ct);
    }

    /// <summary>
    /// Awards points for a bill that this payment has just settled. Only on the move INTO paid, so a
    /// further payment against an already-paid order cannot award twice. Never fails the payment:
    /// the money is taken, and points can be corrected by hand from the customer record.
    /// </summary>
    public static async Task EarnIfJustPaidAsync(POSDbContext posDb, bool wasPaid, Result<OrderDto> result, CancellationToken ct)
    {
        if (wasPaid || result.IsFailure || result.Value.Status != "paid" || result.Value.CustomerId is not { } customerId) return;
        try { await GiveAsync(posDb, customerId, Math.Floor(result.Value.Total / SpendPerPoint), ct); }
        catch { /* see summary */ }
    }
}
