using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class CreateOrderHandler(RestaurantDbContext db, ICurrentUser currentUser, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<CreateOrderCommand, OrderDto>
{
    public async Task<Result<OrderDto>> Handle(CreateOrderCommand cmd, CancellationToken ct)
    {
        // A client-supplied SessionId ties this order to an open shift — validated up front so a
        // stale/closed session reference (e.g. a cached sessionId after the shift was closed
        // elsewhere) never silently creates an order that can't reconcile at end-of-day.
        if (cmd.SessionId.HasValue)
        {
            var sessionCheck = await PosSessionLedger.ValidateOpenSessionAsync(db, cmd.SessionId.Value, ct);
            if (sessionCheck.IsFailure)
                return Result.Failure<OrderDto>(sessionCheck.Error);
        }

        // Takeaway / delivery orders are not tied to a table.
        var isTableOrder = cmd.OrderType == "dine_in" && cmd.TableId.HasValue && cmd.TableId.Value != Guid.Empty;

        Order order;
        Table? table = null;
        if (isTableOrder)
        {
            table = await db.Tables.FindAsync([cmd.TableId!.Value], ct);
            if (table is null || table.IsDeleted)
                return Result.Failure<OrderDto>(Error.NotFoundById("Table", cmd.TableId!.Value));

            order = new Order(table.Id, table.TableNumber, cmd.Waiter, cmd.Covers, "dine_in", cmd.Notes,
                cmd.BranchId, cmd.SessionId, currentUser.Id, customerId: cmd.CustomerId);
        }
        else
        {
            var label = cmd.OrderType == "delivery" ? "Delivery" : "Takeaway";
            order = new Order(Guid.Empty, label, cmd.Waiter, cmd.Covers,
                cmd.OrderType == "delivery" ? "delivery" : "takeaway", cmd.Notes,
                cmd.BranchId, cmd.SessionId, currentUser.Id, customerId: cmd.CustomerId);
        }

        foreach (var li in cmd.Items)
        {
            var built = await OrderItemFactory.BuildAsync(
                db, order.Id, li.MenuItemId, li.Quantity, li.Modifiers, li.SelectedModifierIds, ct,
                li.CourseNumber ?? order.CurrentCourse);
            if (built.IsFailure)
                return Result.Failure<OrderDto>(built.Error);
            order.Items.Add(built.Value);
        }
        order.Recalculate();
        await HappyHourApplier.ApplyIfMatchingAsync(db, order, currentUser.Id, ct);
        table?.Occupy(order.Id, cmd.Waiter);

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        if (isTableOrder) await realtime.NotifyTablesChangedAsync(ct);

        return Result.Success(OrderMappings.ToDto(order));
    }
}
