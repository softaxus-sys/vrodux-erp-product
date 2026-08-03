using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Services;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Deducts recipe-linked ingredient stock when order items are served, and auto-flips a menu item's
/// availability off ("86'd") when serving it just depleted one of its ingredients. Reuses
/// RecipeStockService (Recipe.Infrastructure) — the same logic RecipesController's own POST
/// /{id}/deduct endpoint calls — rather than duplicating the batch/per-serving math here.
///
/// Best-effort for the common case: a missing/unlinked recipe for a menu item is normal (most items
/// have none yet) and is silently skipped, never blocking the serve action itself. A recipe that IS
/// linked but fails to deduct for another reason (e.g. no servings configured) is a real
/// misconfiguration and gets logged, still without blocking the serve.
///
/// Idempotent via OrderItem.StockDeducted — safe to call more than once for the same item (e.g. if a
/// per-item kitchen-status "served" transition and a whole-order serve both end up touching the same
/// line, or a retried ConcurrencyRetry attempt re-runs this): the flag is checked-and-set atomically
/// against the tracked entity before doing any inventory work.
/// </summary>
internal static class RecipeDeductionSupport
{
    /// <summary>
    /// Deducts stock for one served line and, if that deduction depleted any linked ingredient, flips
    /// the menu item's IsAvailable off. <paramref name="item"/> must be a tracked entity on
    /// <paramref name="restaurantDb"/> — its StockDeducted flag and any menu-item availability change
    /// are persisted via <paramref name="restaurantDb"/>.SaveChangesAsync at the end of this call.
    /// </summary>
    public static async Task DeductForServedItemAsync(
        RestaurantDbContext restaurantDb, RecipeDbContext recipeDb, InventoryDbContext inventoryDb,
        OrderItem item, string orderNumber, ILogger logger, CancellationToken ct)
    {
        if (!item.MarkStockDeducted()) return; // already deducted for this line — never double-deduct
        if (item.Quantity <= 0) return;

        var recipe = await recipeDb.Recipes.AsNoTracking()
            .FirstOrDefaultAsync(r => r.MenuItemId == item.MenuItemId && !r.IsDeleted && r.Status == "active", ct);
        if (recipe is null)
        {
            await restaurantDb.SaveChangesAsync(ct); // still persist the StockDeducted flag
            return; // no recipe linked to this menu item yet — nothing to deduct, not an error
        }

        var result = await RecipeStockService.DeductAsync(
            recipeDb, inventoryDb, recipe.Id, item.Quantity,
            reference: orderNumber, notes: null, ct);

        if (result.IsFailure)
        {
            logger.LogWarning(
                "Recipe stock deduction failed for MenuItemId {MenuItemId} (RecipeId {RecipeId}) on order {OrderNumber}: {Error}",
                item.MenuItemId, recipe.Id, orderNumber, result.Error.Description);
            await restaurantDb.SaveChangesAsync(ct);
            return;
        }

        if (result.Value.AnyIngredientDepleted)
        {
            var menuItem = await restaurantDb.MenuItems.FirstOrDefaultAsync(m => m.Id == item.MenuItemId && !m.IsDeleted, ct);
            if (menuItem is not null && menuItem.IsAvailable)
                menuItem.SetAvailability(false);
        }

        await restaurantDb.SaveChangesAsync(ct);
    }

    /// <summary>Deducts stock for every non-deleted, not-yet-deducted item on an order (whole-order
    /// serve path) — items already deducted via the per-item path are skipped at the query level.</summary>
    public static async Task DeductForServedOrderAsync(
        RestaurantDbContext restaurantDb, RecipeDbContext recipeDb, InventoryDbContext inventoryDb,
        Guid orderId, string orderNumber, ILogger logger, CancellationToken ct)
    {
        var items = await restaurantDb.OrderItems
            .Where(i => i.OrderId == orderId && !i.IsDeleted && !i.StockDeducted)
            .ToListAsync(ct);

        foreach (var item in items)
            await DeductForServedItemAsync(restaurantDb, recipeDb, inventoryDb, item, orderNumber, logger, ct);
    }
}
