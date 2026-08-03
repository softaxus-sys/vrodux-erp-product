using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Builds an OrderItem from a menu item + quantity + optional structured modifier selections,
/// validating the selections against the item's assigned ModifierGroups (min/max per group) before
/// snapshotting them. Shared by CreateOrderHandler and AddOrderItemsHandler so the validation rules
/// can't drift between the two entry points.
/// </summary>
internal static class OrderItemFactory
{
    public static async Task<Result<OrderItem>> BuildAsync(
        RestaurantDbContext db, Guid orderId, Guid menuItemId, int quantity, string? notes,
        IReadOnlyList<Guid>? selectedModifierIds, CancellationToken ct, int courseNumber = 1)
    {
        var menuItem = await db.MenuItems.FindAsync([menuItemId], ct);
        if (menuItem is null || menuItem.IsDeleted)
            return Result.Failure<OrderItem>(Error.NotFoundById("MenuItem", menuItemId));

        var item = new OrderItem(orderId, menuItemId, menuItem.Name, quantity, menuItem.Price, notes, courseNumber);

        var ids = selectedModifierIds ?? [];
        if (ids.Count == 0)
            return Result.Success(item);

        var modifiers = await db.Modifiers
            .Where(m => ids.Contains(m.Id) && !m.IsDeleted && m.IsActive)
            .ToListAsync(ct);

        var assignedGroupIds = await db.MenuItemModifierGroups
            .Where(l => l.MenuItemId == menuItemId)
            .Select(l => l.ModifierGroupId)
            .ToListAsync(ct);

        var selectedGroupIds = modifiers.Select(m => m.ModifierGroupId).Distinct().ToList();
        if (selectedGroupIds.Except(assignedGroupIds).Any())
            return Result.Failure<OrderItem>(
                Error.Custom("Modifier.Conflict", "One or more selected modifiers don't belong to this item."));

        var assignedGroups = await db.ModifierGroups
            .Where(g => assignedGroupIds.Contains(g.Id) && !g.IsDeleted)
            .ToListAsync(ct);

        foreach (var group in assignedGroups)
        {
            var count = modifiers.Count(m => m.ModifierGroupId == group.Id);
            if (count < group.MinSelect)
                return Result.Failure<OrderItem>(Error.Custom("Modifier.Conflict",
                    $"'{group.Name}' requires at least {group.MinSelect} selection(s)."));
            if (count > group.MaxSelect)
                return Result.Failure<OrderItem>(Error.Custom("Modifier.Conflict",
                    $"'{group.Name}' allows at most {group.MaxSelect} selection(s)."));
        }

        item.SetSelectedModifiers(modifiers.Select(m => ((Guid?)m.Id, m.Name, m.PriceDelta)));
        return Result.Success(item);
    }
}
