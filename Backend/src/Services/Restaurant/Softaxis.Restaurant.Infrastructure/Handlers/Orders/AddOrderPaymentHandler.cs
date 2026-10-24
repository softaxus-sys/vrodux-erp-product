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
/// Records a (possibly partial) payment — supports split-tender (multiple methods) and split-bill
/// (multiple guest payments). See PayOrderHandler for why this is tracked-entity + retry, not raw SQL.
/// </summary>
internal sealed class AddOrderPaymentHandler(RestaurantDbContext db, POSDbContext posDb, IRestaurantRealtimeNotifier realtime,
    Fbr.FbrReporter fbr)
    : ICommandHandler<AddOrderPaymentCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(AddOrderPaymentCommand cmd, CancellationToken ct)
    {
        var wasPaid = await db.Orders.AsNoTracking().AnyAsync(x => x.Id == cmd.OrderId && x.Status == "paid", ct);
        var result = await PayAsync(cmd, ct);
        await LoyaltySupport.EarnIfJustPaidAsync(posDb, wasPaid, result, ct);
        return await Fbr.FbrAfterPayment.ReportIfDueAsync(fbr, result, ct);
    }

    private async Task<Result<OrderDto>> PayAsync(AddOrderPaymentCommand cmd, CancellationToken ct)
    {
        // Never more than is owed: an over-typed amount (1000 for 100) would otherwise be recorded
        // as takings and as cash expected in the drawer. Checked before any wallet is charged.
        var owed = await db.Orders.AsNoTracking().Where(x => x.Id == cmd.OrderId && !x.IsDeleted)
            .Select(x => new { x.Status, Due = x.Total + x.TipAmount - x.AmountPaid }).FirstOrDefaultAsync(ct);
        if (owed is { Status: "paid" })
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", "This bill is already paid."));
        if (owed is not null && cmd.Amount > owed.Due + 0.01m)
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict",
                $"That is more than is owed on this bill ({owed.Due:0.00})."));

        // Wallet/house-account charge, if applicable — see CustomerPaymentSupport for why this must
        // run exactly once, outside the retry loop below, before any Order row is mutated.
        if (CustomerPaymentSupport.IsCustomerFundedMethod(cmd.Method))
        {
            var preflight = await db.Orders.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
            if (preflight is null)
                return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));

            var chargeResult = await CustomerPaymentSupport.ChargeAsync(
                posDb, preflight.CustomerId, cmd.Method, cmd.Amount, preflight.Id, ct);
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

            o.AddPayment(cmd.Method, cmd.Amount, cmd.Reference);
            // See ApplyOrderDiscountHandler — AddPayment() appends a new OrderPayment reachable
            // only via navigation from the already-tracked Order, which EF marks Modified instead
            // of Added.
            db.OrderPayments.Add(o.Payments[^1]);

            await OrderPaymentSupport.FreeTableIfFullyPaidAsync(db, o, ct);
            await db.SaveChangesAsync(ct);
            await OrderPaymentSupport.RecordSaleIfSessionAsync(db, o, cmd.Amount, ct);
            if (o.Status == "paid") await realtime.NotifyTablesChangedAsync(ct);

            return Result.Success(OrderMappings.ToDto(o));
        });
    }
}
