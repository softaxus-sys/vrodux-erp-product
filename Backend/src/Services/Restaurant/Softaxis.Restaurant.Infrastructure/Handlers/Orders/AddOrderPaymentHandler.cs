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
internal sealed class AddOrderPaymentHandler(RestaurantDbContext db, POSDbContext posDb, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<AddOrderPaymentCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(AddOrderPaymentCommand cmd, CancellationToken ct)
    {
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
