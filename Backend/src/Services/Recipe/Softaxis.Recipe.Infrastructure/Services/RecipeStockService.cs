using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Persistence;

namespace Softaxis.Recipe.Infrastructure.Services;

public sealed record StockDeductionResult(int Deducted, int Portions, Guid RecipeId, bool AnyIngredientDepleted);

/// <summary>
/// Shared recipe → inventory deduction logic — called both by RecipesController's own
/// POST /{id}/deduct endpoint and by Restaurant's "mark served" handlers. Ingredient
/// Quantity is per BATCH (yields Recipe.Servings portions), so the per-portion deduction is
/// (ingredient.Quantity / recipe.Servings) * portions.
/// </summary>
public static class RecipeStockService
{
    public static async Task<Result<StockDeductionResult>> DeductAsync(
        RecipeDbContext recipeDb, InventoryDbContext inventoryDb,
        Guid recipeId, int portions, string? reference, string? notes, CancellationToken ct)
    {
        var recipe = await recipeDb.Recipes.AsNoTracking().Include(x => x.Ingredients)
            .FirstOrDefaultAsync(x => x.Id == recipeId && !x.IsDeleted, ct);
        if (recipe is null) return Result.Failure<StockDeductionResult>(Error.NotFoundById("Recipe", recipeId));
        if (recipe.Servings <= 0)
            return Result.Failure<StockDeductionResult>(Error.Custom("Recipe.Conflict", "Recipe has no servings configured."));

        var linkedIngredients = recipe.Ingredients.Where(i => !i.IsDeleted && i.InventoryProductId.HasValue).ToList();
        if (linkedIngredients.Count == 0)
            return Result.Success(new StockDeductionResult(0, portions, recipe.Id, false));

        var productIds = linkedIngredients.Select(i => i.InventoryProductId!.Value).Distinct().ToList();
        var products = await inventoryDb.Products.Where(p => productIds.Contains(p.Id) && !p.IsDeleted).ToListAsync(ct);

        var deducted = 0;
        foreach (var ing in linkedIngredients)
        {
            var product = products.FirstOrDefault(p => p.Id == ing.InventoryProductId);
            if (product is null) continue;

            var deductQty = ing.Quantity / recipe.Servings * portions;
            product.AdjustStock(-deductQty);
            inventoryDb.StockMovements.Add(new StockMovement(
                product.Id, MovementTypes.WriteOff, -deductQty, product.CostPrice,
                reference, notes ?? $"Recipe deduction: {recipe.MenuItemName} × {portions}", null));
            deducted++;
        }

        await inventoryDb.SaveChangesAsync(ct);

        var anyDepleted = products.Any(p => productIds.Contains(p.Id) && p.StockQuantity <= 0);
        return Result.Success(new StockDeductionResult(deducted, portions, recipe.Id, anyDepleted));
    }
}
