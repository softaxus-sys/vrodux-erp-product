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

/// <summary>
/// Pays the full outstanding balance in one go. Rewritten off tracked EF entities + optimistic
/// concurrency (Order.RowVersion) — the pre-migration controller bypassed EF change-tracking with raw
/// `ExecuteSqlAsync` here specifically to dodge a concurrency bug; now that there's a real concurrency
/// token, the conflict is handled properly via retry instead of avoided.
/// </summary>
internal sealed class PayOrderHandler(RestaurantDbContext db, POSDbContext posDb, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<PayOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(PayOrderCommand cmd, CancellationToken ct)
    {
        // Wallet/house-account charge, if applicable — see CustomerPaymentSupport for why this must
        // run exactly once, outside the retry loop below, before any Order row is mutated. The charged
        // amount is reused (not recomputed) inside the retry loop so the wallet debit and the recorded
        // order payment always agree, even if something else changes the order's total in between.
        decimal? preChargedAmount = null;
        if (CustomerPaymentSupport.IsCustomerFundedMethod(cmd.Method))
        {
            var preflight = await db.Orders.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
            if (preflight is null)
                return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));

            preChargedAmount = preflight.Outstanding > 0 ? preflight.Outstanding : preflight.Total + preflight.TipAmount;
            var chargeResult = await CustomerPaymentSupport.ChargeAsync(
                posDb, preflight.CustomerId, cmd.Method, preChargedAmount.Value, preflight.Id, ct);
            if (chargeResult.IsFailure)
                return Result.Failure<OrderDto>(chargeResult.Error);
        }

        return await ConcurrencyRetry.ExecuteAsync(db, async () =>
        {
            var o = await db.Orders.Include(x => x.Items).Include(x => x.Payments)
                .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
            if (o is null)
                return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
            if (o.Status == "cancelled")
                return Result.Failure<OrderDto>(Error.Custom("Order.Cancelled", "Order is cancelled."));
            if (o.Status == "split")
                return Result.Failure<OrderDto>(Error.Custom("Order.Conflict",
                    "This order was split — pay its individual splits instead."));
            if (o.Status == "held")
                return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", "Recall this order before paying it."));

            var sessionCheck = await OrderPaymentSupport.EnsureSessionStillOpenAsync(db, o, ct);
            if (sessionCheck.IsFailure)
                return Result.Failure<OrderDto>(sessionCheck.Error);

            var due = preChargedAmount ?? (o.Outstanding > 0 ? o.Outstanding : o.Total + o.TipAmount);
            o.AddPayment(cmd.Method, due, null);
            // See ApplyOrderDiscountHandler — AddPayment() appends a new OrderPayment reachable
            // only via navigation from the already-tracked Order, which EF marks Modified instead
            // of Added.
            db.OrderPayments.Add(o.Payments[^1]);

            await OrderPaymentSupport.FreeTableIfFullyPaidAsync(db, o, ct);
            await db.SaveChangesAsync(ct);
            await OrderPaymentSupport.RecordSaleIfSessionAsync(db, o, due, ct);
            if (o.Status == "paid") await realtime.NotifyTablesChangedAsync(ct);

            return Result.Success(OrderMappings.ToDto(o));
        });
    }
}
