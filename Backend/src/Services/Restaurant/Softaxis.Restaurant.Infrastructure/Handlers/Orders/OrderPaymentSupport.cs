using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal static class OrderPaymentSupport
{
    /// <summary>
    /// Frees the dine-in table once its order is fully paid (no-op for takeaway/delivery, whose
    /// TableId is Guid.Empty). For a split-bill child, this only fires once every sibling split is
    /// also paid — one guest settling their share shouldn't free a table other guests are still
    /// eating/paying at. Once the last sibling pays, the parent is marked settled too (its own
    /// monetary fields are all zero by then, so this never double-counts revenue in reports).
    /// </summary>
    public static async Task FreeTableIfFullyPaidAsync(
        RestaurantDbContext db, Domain.Entities.Order order, CancellationToken ct)
    {
        if (order.Status != "paid" || order.TableId == Guid.Empty) return;

        if (order.ParentOrderId.HasValue)
        {
            var siblingsUnpaid = await db.Orders.AnyAsync(o =>
                o.ParentOrderId == order.ParentOrderId && o.Id != order.Id && !o.IsDeleted && o.Status != "paid", ct);
            if (siblingsUnpaid) return;

            var parent = await db.Orders.FindAsync([order.ParentOrderId.Value], ct);
            parent?.MarkSplitSettled();
        }

        var table = await db.Tables.FindAsync([order.TableId], ct);
        table?.Free();
    }

    /// <summary>
    /// If this order was opened under a tracked POS shift, re-confirms that shift is *still* open
    /// before the payment is allowed to land — the shift could have been closed by a supervisor
    /// between order creation and payment (e.g. a long-running dine-in bill). Orders with no
    /// SessionId (legacy, or a register not using shift tracking) always pass — same as before.
    /// </summary>
    public static async Task<Result> EnsureSessionStillOpenAsync(
        RestaurantDbContext db, Domain.Entities.Order order, CancellationToken ct)
    {
        if (!order.SessionId.HasValue) return Result.Success();

        var check = await PosSessionLedger.ValidateOpenSessionAsync(db, order.SessionId.Value, ct);
        return check.IsFailure ? Result.Failure(check.Error) : Result.Success();
    }

    /// <summary>Bumps the order's POS session totals for the amount just paid (no-op if the order
    /// isn't tied to a tracked shift). Call only after the payment has been saved.</summary>
    public static Task RecordSaleIfSessionAsync(
        RestaurantDbContext db, Domain.Entities.Order order, decimal amount, CancellationToken ct) =>
        order.SessionId.HasValue
            ? PosSessionLedger.RecordSaleAsync(db, order.SessionId.Value, amount, ct)
            : Task.CompletedTask;
}
