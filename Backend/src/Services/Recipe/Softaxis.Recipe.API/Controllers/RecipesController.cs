using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Recipe.Domain.Entities;
using Softaxis.Recipe.Infrastructure.Persistence;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Recipe.API.Controllers;

[ApiController][Route("api/recipes")][Authorize]
public sealed class RecipesController(
    RecipeDbContext db,
    InventoryDbContext inventoryDb,
    RestaurantDbContext restaurantDb) : ControllerBase
{
    // ── Summary ──────────────────────────────────────────────────────────────
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var recipes = await db.Recipes.AsNoTracking().Include(r => r.Ingredients)
            .Where(r => !r.IsDeleted).ToListAsync(ct);

        return Ok(new {
            total    = recipes.Count,
            active   = recipes.Count(r => r.Status == "active"),
            draft    = recipes.Count(r => r.Status == "draft"),
            archived = recipes.Count(r => r.Status == "archived"),
            avgCostPerServing = recipes.Any()
                ? Math.Round(recipes.Average(r => (double)r.CostPerServing), 2) : 0,
            totalIngredients  = recipes.Sum(r => r.Ingredients.Count(i => !i.IsDeleted)),
            linkedToInventory = recipes.SelectMany(r => r.Ingredients)
                .Count(i => !i.IsDeleted && i.InventoryProductId.HasValue),
        });
    }

    // ── Get all — enriched with live inventory stock ──────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var recipes = await db.Recipes.AsNoTracking().Include(r => r.Ingredients)
            .Where(r => !r.IsDeleted).OrderBy(r => r.MenuItemName).ToListAsync(ct);

        var stockMap = await BuildStockMap(
            recipes.SelectMany(r => r.Ingredients)
                   .Where(i => i.InventoryProductId.HasValue)
                   .Select(i => i.InventoryProductId!.Value).Distinct().ToList(), ct);

        return Ok(recipes.Select(r => ToDto(r, stockMap)));
    }

    // ── Get by ID — includes portionsCanMake ─────────────────────────────────
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await db.Recipes.AsNoTracking().Include(x => x.Ingredients)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();

        var stockMap = await BuildStockMap(
            r.Ingredients.Where(i => i.InventoryProductId.HasValue)
                         .Select(i => i.InventoryProductId!.Value).Distinct().ToList(), ct);

        return Ok(ToDto(r, stockMap));
    }

    // ── Get by MenuItem ID — used by Restaurant kitchen ──────────────────────
    [HttpGet("by-menu-item/{menuItemId:guid}")]
    public async Task<IActionResult> GetByMenuItem(Guid menuItemId, CancellationToken ct)
    {
        var r = await db.Recipes.AsNoTracking().Include(x => x.Ingredients)
            .FirstOrDefaultAsync(x => x.MenuItemId == menuItemId && !x.IsDeleted, ct);
        if (r is null) return NotFound();

        var stockMap = await BuildStockMap(
            r.Ingredients.Where(i => i.InventoryProductId.HasValue)
                         .Select(i => i.InventoryProductId!.Value).Distinct().ToList(), ct);

        return Ok(ToDto(r, stockMap));
    }

    private async Task<Dictionary<Guid, StockInfo>> BuildStockMap(List<Guid> ids, CancellationToken ct) =>
        ids.Count == 0 ? [] :
        await inventoryDb.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new StockInfo(p.Id, p.StockQuantity, p.Unit, p.CostPrice))
            .ToDictionaryAsync(s => s.Id, ct);

    // ── Create ────────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRecipeReq req, CancellationToken ct)
    {
        // Validate MenuItem exists in Restaurant
        var menuItemExists = await restaurantDb.MenuItems
            .AnyAsync(m => m.Id == req.MenuItemId && !m.IsDeleted, ct);
        if (!menuItemExists) return BadRequest("Menu item not found in Restaurant");

        var recipe = new Recipe.Domain.Entities.Recipe(
            req.MenuItemId, req.MenuItemName, req.Description,
            req.Servings, req.PrepTimeMinutes, req.CookTimeMinutes,
            req.Instructions, req.Notes);

        foreach (var ing in req.Ingredients)
        {
            // Try to resolve cost from inventory if product linked
            var cost = ing.CostPerUnit;
            if (ing.InventoryProductId.HasValue && cost == 0)
            {
                var prod = await inventoryDb.Products.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == ing.InventoryProductId, ct);
                if (prod is not null) cost = prod.CostPrice;
            }
            recipe.Ingredients.Add(new RecipeIngredient(
                recipe.Id, ing.InventoryProductId, ing.ProductName,
                ing.Quantity, ing.Unit, cost));
        }

        db.Recipes.Add(recipe);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = recipe.Id }, new {
            recipe.Id, recipe.RecipeNumber, recipe.MenuItemName, recipe.CostPerServing,
        });
    }

    // ── Activate / Archive ────────────────────────────────────────────────────
    [HttpPatch("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken ct)
    {
        var r = await db.Recipes.FindAsync([id], ct);
        if (r is null) return NotFound(); r.Activate(); await db.SaveChangesAsync(ct);
        return Ok(new { r.Id, r.Status });
    }

    [HttpPatch("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        var r = await db.Recipes.FindAsync([id], ct);
        if (r is null) return NotFound(); r.Archive(); await db.SaveChangesAsync(ct);
        return Ok(new { r.Id, r.Status });
    }

    // ── Deduct inventory for N portions of this recipe ────────────────────────
    // Called after an order item is marked served/paid
    [HttpPost("{id:guid}/deduct")]
    public async Task<IActionResult> DeductInventory(Guid id, [FromBody] DeductReq req, CancellationToken ct)
    {
        var r = await db.Recipes.AsNoTracking().Include(x => x.Ingredients)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();

        var linkedIngredients = r.Ingredients
            .Where(i => !i.IsDeleted && i.InventoryProductId.HasValue).ToList();

        if (!linkedIngredients.Any())
            return Ok(new { deducted = 0, message = "No inventory-linked ingredients" });

        var productIds = linkedIngredients.Select(i => i.InventoryProductId!.Value).ToList();
        var products = await inventoryDb.Products
            .Where(p => productIds.Contains(p.Id)).ToListAsync(ct);

        int deducted = 0;
        foreach (var ing in linkedIngredients)
        {
            var product = products.FirstOrDefault(p => p.Id == ing.InventoryProductId);
            if (product is null) continue;

            // qty per portion = (ingredient.Quantity / recipe.Servings) * portions
            var deductQty = ing.Quantity / r.Servings * req.Portions;
            product.AdjustStock(-deductQty);
            deducted++;
        }

        await inventoryDb.SaveChangesAsync(ct);
        return Ok(new { deducted, portions = req.Portions, recipeId = r.Id });
    }

    // ── Sync ingredient costs from inventory ──────────────────────────────────
    [HttpPost("{id:guid}/sync-costs")]
    public async Task<IActionResult> SyncCosts(Guid id, CancellationToken ct)
    {
        var r = await db.Recipes.Include(x => x.Ingredients)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();

        var linkedIds = r.Ingredients
            .Where(i => i.InventoryProductId.HasValue)
            .Select(i => i.InventoryProductId!.Value).ToList();

        var products = await inventoryDb.Products.AsNoTracking()
            .Where(p => linkedIds.Contains(p.Id))
            .Select(p => new { p.Id, p.CostPrice }).ToListAsync(ct);

        int synced = 0;
        foreach (var ing in r.Ingredients.Where(i => i.InventoryProductId.HasValue))
        {
            var prod = products.FirstOrDefault(p => p.Id == ing.InventoryProductId);
            if (prod is null) continue;
            ing.UpdateCost(prod.CostPrice); synced++;
        }

        await db.SaveChangesAsync(ct);
        return Ok(new { synced, newCostPerServing = r.CostPerServing });
    }

    // ── Delete ────────────────────────────────────────────────────────────────
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await db.Recipes.FindAsync([id], ct);
        if (r is null) return NotFound(); r.Delete(); await db.SaveChangesAsync(ct);
        return NoContent();
    }

    // ── DTO helper ────────────────────────────────────────────────────────────
    private static object ToDto(Recipe.Domain.Entities.Recipe r,
        Dictionary<Guid, StockInfo> stockMap)
    {
        var ingredients = r.Ingredients.Where(i => !i.IsDeleted).Select(i =>
        {
            StockInfo? stock = i.InventoryProductId.HasValue && stockMap.TryGetValue(i.InventoryProductId.Value, out var s) ? s : null;

            decimal stockQty = stock is not null ? stock.StockQuantity : -1;
            decimal portionsFromThis = stock is not null && i.Quantity > 0 && r.Servings > 0
                ? Math.Floor(stockQty / i.Quantity * r.Servings)
                : -1;

            return new {
                i.Id, i.InventoryProductId, i.ProductName, i.Quantity, i.Unit,
                i.CostPerUnit, lineTotal = i.LineTotal,
                stockQuantity = stockQty >= 0 ? stockQty : (decimal?)null,
                portionsCanMake = portionsFromThis >= 0 ? portionsFromThis : (decimal?)null,
            };
        }).ToList();

        // portionsCanMake = min over all linked ingredients (bottleneck)
        var linked = ingredients.Where(i => i.portionsCanMake.HasValue).ToList();
        decimal? portionsCanMake = linked.Any() ? linked.Min(i => i.portionsCanMake!.Value) : null;

        return new {
            r.Id, r.RecipeNumber, r.MenuItemId, r.MenuItemName, r.Description,
            r.Servings, r.PrepTimeMinutes, r.CookTimeMinutes, r.Status,
            r.Instructions, r.Notes, r.CreatedAt,
            costPerServing = r.CostPerServing,
            portionsCanMake,
            ingredients,
        };
    }

    private sealed record StockInfo(Guid Id, decimal StockQuantity, string Unit, decimal CostPrice);

    // ── Request records ───────────────────────────────────────────────────────
    public record CreateRecipeReq(
        Guid MenuItemId, string MenuItemName, string? Description,
        int Servings, int PrepTimeMinutes, int CookTimeMinutes,
        string? Instructions, string? Notes,
        List<IngredientReq> Ingredients);

    public record IngredientReq(
        Guid? InventoryProductId, string ProductName,
        decimal Quantity, string Unit, decimal CostPerUnit);

    public record DeductReq(int Portions);
}
