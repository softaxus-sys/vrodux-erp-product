using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

/// <summary>
/// Restaurant's first refund capability — didn't exist before this. Unlike payments, a refund is
/// never blocked by the tied shift being closed (a customer complaint the next day shouldn't be
/// impossible to refund); it just won't retroactively touch that shift's totals in that case — see
/// PosSessionLedger.RecordRefundAsync's own Status guard.
/// </summary>
internal sealed class RefundOrderHandler(RestaurantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<RefundOrderCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(RefundOrderCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(RefundOrderCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is not { } userId)
            return Result.Failure<OrderDto>(Error.Custom("Auth.Unresolved", "Could not resolve the current user."));

        var o = await db.Orders.Include(x => x.Items).Include(x => x.Payments).Include(x => x.Refunds)
            .Include(x => x.Discounts).Include(x => x.VoidLogs)
            .FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (o is null)
            return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        if (o.Status == "cancelled")
            return Result.Failure<OrderDto>(Error.Custom("Order.Cancelled", "Order is cancelled."));
        if (o.AmountPaid <= 0)
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict", "Nothing has been paid on this order to refund."));
        if (cmd.Amount > o.AmountPaid)
            return Result.Failure<OrderDto>(Error.Custom("Order.Conflict",
                $"Refund amount cannot exceed the amount paid ({o.AmountPaid:F2})."));

        o.Refund(cmd.Amount, cmd.Reason, cmd.Method, userId);
        // See ApplyOrderDiscountHandler — Refund() appends a new OrderRefund reachable only via
        // navigation from the already-tracked Order, which EF marks Modified instead of Added.
        db.OrderRefunds.Add(o.Refunds[^1]);
        await db.SaveChangesAsync(ct);

        if (o.SessionId.HasValue)
            await PosSessionLedger.RecordRefundAsync(db, o.SessionId.Value, cmd.Amount, ct);

        return Result.Success(OrderMappings.ToDto(o));
    }
}
