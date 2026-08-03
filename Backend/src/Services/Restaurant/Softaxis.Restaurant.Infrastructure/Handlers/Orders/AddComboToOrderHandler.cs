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

internal sealed class AddComboToOrderHandler(RestaurantDbContext db, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<AddComboToOrderCommand, OrderDto>
{
    public Task<Result<OrderDto>> Handle(AddComboToOrderCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, () => HandleOnce(cmd, ct));

    private async Task<Result<OrderDto>> HandleOnce(AddComboToOrderCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.OrderId && !x.IsDeleted, ct);
        if (order is null) return Result.Failure<OrderDto>(Error.NotFoundById("Order", cmd.OrderId));
        if (order.Status is "paid" or "cancelled" or "split" or "held")
            return Result.Failure<OrderDto>(Error.Custom("Order.Closed", "Cannot modify a closed order."));

        var combo = await db.Combos.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.ComboId && !x.IsDeleted, ct);
        if (combo is null) return Result.Failure<OrderDto>(Error.NotFoundById("Combo", cmd.ComboId));
        if (!combo.IsActive) return Result.Failure<OrderDto>(Error.Custom("Combo.Conflict", "This combo is no longer available."));

        if (cmd.Selections.Count != combo.Items.Count ||
            cmd.Selections.Select(s => s.ComboItemId).Distinct().Count() != combo.Items.Count)
            return Result.Failure<OrderDto>(Error.Custom("Combo.Conflict", "Every combo slot must be resolved exactly once."));

        var selectionBySlot = cmd.Selections.ToDictionary(s => s.ComboItemId);
        var menuItemIds = cmd.Selections.Select(s => s.MenuItemId).Distinct().ToList();
        var menuItems = await db.MenuItems.Where(m => menuItemIds.Contains(m.Id) && !m.IsDeleted).ToListAsync(ct);
        var menuItemsById = menuItems.ToDictionary(m => m.Id);

        var resolved = new List<(Guid MenuItemId, string Name, decimal Price, int Quantity)>();
        foreach (var slot in combo.Items)
        {
            if (!selectionBySlot.TryGetValue(slot.Id, out var selection))
                return Result.Failure<OrderDto>(Error.Custom("Combo.Conflict", "Every combo slot must be resolved exactly once."));

            if (!menuItemsById.TryGetValue(selection.MenuItemId, out var menuItem))
                return Result.Failure<OrderDto>(Error.NotFoundById("MenuItem", selection.MenuItemId));

            if (slot.MenuItemId.HasValue && slot.MenuItemId != selection.MenuItemId)
                return Result.Failure<OrderDto>(Error.Custom("Combo.Conflict", "A fixed combo slot's item can't be substituted."));
            if (slot.CategoryId.HasValue && menuItem.CategoryId != slot.CategoryId)
                return Result.Failure<OrderDto>(Error.Custom("Combo.Conflict", $"The chosen item doesn't belong to this slot's category."));

            resolved.Add((menuItem.Id, menuItem.Name, menuItem.Price, slot.Quantity));
        }

        var naturalTotal = resolved.Sum(r => r.Price * r.Quantity);
        var factor = naturalTotal > 0 ? combo.Price / naturalTotal : 1m;
        var comboGroupId = Guid.NewGuid();

        foreach (var r in resolved)
        {
            var unitPrice = Math.Round(r.Price * factor, 2);
            var item = new OrderItem(order.Id, r.MenuItemId, r.Name, r.Quantity, unitPrice, null,
                order.CurrentCourse, comboGroupId);
            order.Items.Add(item);
            // See ApplyOrderDiscountHandler — a new child reached only via navigation from an
            // already-tracked Order gets marked Modified (not Added) by EF, since its Id is
            // already set; without this explicit Add, SaveChanges always fails.
            db.OrderItems.Add(item);
        }

        order.Recalculate();
        await db.SaveChangesAsync(ct);
        await realtime.NotifyKitchenChangedAsync(ct);
        return Result.Success(OrderMappings.ToDto(order));
    }
}
