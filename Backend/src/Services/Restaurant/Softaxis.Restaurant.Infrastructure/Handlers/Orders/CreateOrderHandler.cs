using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class CreateOrderHandler(
    RestaurantDbContext db, ICurrentUser currentUser, IRestaurantRealtimeNotifier realtime, IBranchAccessGuard branchAccess,
    Softaxis.POS.Infrastructure.Persistence.POSDbContext posDb, LocalBranchGuard localBranch)
    : ICommandHandler<CreateOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(CreateOrderCommand cmd, CancellationToken ct)
    {
        // An offline order uploaded again (a retried sync) is the same order, not a new one.
        if (cmd.Offline is { } off)
        {
            var existing = await db.Orders.AsNoTracking()
                .Include(x => x.Items).ThenInclude(i => i.SelectedModifiers)
                .FirstOrDefaultAsync(x => x.ClientRef == off.ClientRef && !x.IsDeleted, ct);
            if (existing is not null) return Result.Success(OrderMappings.ToDto(existing));
        }

        // Takeaway / delivery orders are not tied to a table.
        var isTableOrder = cmd.OrderType == "dine_in" && cmd.TableId.HasValue && cmd.TableId.Value != Guid.Empty;

        Table? table = null;
        if (isTableOrder)
        {
            table = await db.Tables.FindAsync([cmd.TableId!.Value], ct);
            if (table is null || table.IsDeleted)
                return Result.Failure<OrderDto>(Error.NotFoundById("Table", cmd.TableId!.Value));
        }

        // A table belongs to one branch, so its branch is the order's branch whatever the screen sent.
        var branchId = table?.BranchId ?? cmd.BranchId;
        if (!await branchAccess.CanWriteToBranchAsync(branchId, ct))
            return Result.Failure<OrderDto>(Error.Custom("Branch.Forbidden", branchId is null
                ? "Choose a branch before taking an order."
                : "You are not assigned to this branch."));

        // A branch with its own server takes its orders there; the cloud does not create them.
        if (await localBranch.IsLocalAsync(branchId, ct))
            return Result.Failure<OrderDto>(LocalBranchGuard.Refusal());

        // A client-supplied SessionId ties this order to an open shift — validated up front so a
        // stale/closed session reference never silently creates an order that can't reconcile.
        var sessionId = cmd.SessionId;
        if (cmd.Offline is not null)
        {
            // Taken offline: the sale has happened. It rides on the shift it was taken under if that
            // is still open, otherwise on this branch's open shift, otherwise on none (and is paid
            // into whichever shift is open when it is settled).
            var stillOpen = sessionId.HasValue
                && (await PosSessionLedger.ValidateOpenSessionAsync(db, sessionId.Value, ct)).IsSuccess
                && await PosSessionLedger.GetSessionBranchAsync(db, sessionId.Value, ct) == branchId;
            if (!stillOpen) sessionId = await PosSessionLedger.FindOpenSessionAsync(db, branchId, ct);
        }
        else if (sessionId.HasValue)
        {
            var sessionCheck = await PosSessionLedger.ValidateOpenSessionAsync(db, sessionId.Value, ct);
            if (sessionCheck.IsFailure)
                return Result.Failure<OrderDto>(sessionCheck.Error);

            // A shift at one branch must not collect another branch's sales — and a shift opened
            // with no branch (before branches existed) must be reopened before taking branch orders.
            var sessionBranch = await PosSessionLedger.GetSessionBranchAsync(db, sessionId.Value, ct);
            if (sessionBranch != branchId)
                return Result.Failure<OrderDto>(Error.Custom("PosSession.Conflict", sessionBranch is null
                    ? "Your open shift has no branch. Close it and open a new shift at this branch."
                    : "Your open shift is at a different branch. Switch branch or close the shift first."));
        }
        else
        {
            // No shift came with the order: the person taking it is on the floor, not at the till.
            // It rides on this branch's cashier shift, so the money lands in that branch's Z-report.
            sessionId = await PosSessionLedger.FindOpenSessionAsync(db, branchId, ct);

            // Someone who cannot open a shift themselves must not create a bill no shift will count.
            if (sessionId is null && !currentUser.IsSuperAdmin && !currentUser.HasPermission("pos.sessions.create"))
                return Result.Failure<OrderDto>(Error.Custom("PosSession.Conflict",
                    "No till is open at this branch. Ask the cashier to open a shift before taking orders."));
        }

        Order order;
        if (table is not null)
        {
            order = new Order(table.Id, table.TableNumber, cmd.Waiter, cmd.Covers, "dine_in", cmd.Notes,
                branchId, sessionId, currentUser.Id, customerId: cmd.CustomerId);
        }
        else
        {
            var label = cmd.OrderType == "delivery" ? "Delivery" : "Takeaway";
            order = new Order(Guid.Empty, label, cmd.Waiter, cmd.Covers,
                cmd.OrderType == "delivery" ? "delivery" : "takeaway", cmd.Notes,
                branchId, sessionId, currentUser.Id, customerId: cmd.CustomerId);
        }

        foreach (var li in cmd.Items)
        {
            var built = await OrderItemFactory.BuildAsync(
                db, order.Id, li.MenuItemId, li.Quantity, li.Modifiers, li.SelectedModifierIds, ct,
                li.CourseNumber ?? order.CurrentCourse, branchId, cmd.Offline is null ? null : li.OfflineUnitPrice);
            if (built.IsFailure)
                return Result.Failure<OrderDto>(built.Error);
            order.Items.Add(built.Value);
        }
        var tax = await TaxProfileResolver.ResolveAsync(db, posDb, branchId, ct);
        order.ApplyTax(tax.Rate, tax.Label, tax.ServiceFee, tax.ReportToFbr);
        if (cmd.Offline is { } taken)
            order.MarkTakenOffline(taken.ClientRef, taken.OccurredAtUtc);   // charged what the till showed — no happy-hour re-pricing
        else
            await HappyHourApplier.ApplyIfMatchingAsync(db, order, currentUser.Id, ct);
        table?.Occupy(order.Id, cmd.Waiter);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        if (isTableOrder) await realtime.NotifyTablesChangedAsync(ct);

        return Result.Success(OrderMappings.ToDto(order));
    }
}
