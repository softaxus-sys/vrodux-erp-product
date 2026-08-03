using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Dashboard.Dtos;
using Softaxis.Restaurant.Application.Dashboard.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Dashboard;

/// <summary>Scoped to recipe-linked ingredients only (not the whole warehouse) — a mixed-mode tenant
/// (Restaurant + standalone Inventory/retail) shouldn't have unrelated stock show up on the kitchen's
/// dashboard. Reuses the Recipe→Inventory project references already added for Epic 7.</summary>
internal sealed class GetInventoryDashboardHandler(RestaurantDbContext restaurantDb, RecipeDbContext recipeDb, InventoryDbContext inventoryDb)
    : IQueryHandler<GetInventoryDashboardQuery, InventoryDashboardDto>
{
    public async Task<Result<InventoryDashboardDto>> Handle(GetInventoryDashboardQuery query, CancellationToken ct)
    {
        var linkedProductIds = await recipeDb.RecipeIngredients.AsNoTracking()
            .Where(i => !i.IsDeleted && i.InventoryProductId != null)
            .Select(i => i.InventoryProductId!.Value)
            .Distinct()
            .ToListAsync(ct);

        var lowStock = await inventoryDb.Products.AsNoTracking()
            .Where(p => !p.IsDeleted && linkedProductIds.Contains(p.Id)
                && p.TrackInventory && p.ReorderLevel > 0 && p.StockQuantity <= p.ReorderLevel)
            .Select(p => new LowStockItemRow(p.Id, p.Name, p.StockQuantity, p.ReorderLevel))
            .OrderBy(p => p.StockQuantity)
            .ToListAsync(ct);

        var eightySixed = await restaurantDb.MenuItems.AsNoTracking()
            .Where(m => !m.IsDeleted && !m.IsAvailable)
            .Select(m => m.Name)
            .OrderBy(n => n)
            .ToListAsync(ct);

        var dto = new InventoryDashboardDto(
            LowStockCount: lowStock.Count,
            LowStockItems: lowStock,
            EightySixedCount: eightySixed.Count,
            EightySixedItemNames: eightySixed);

        return Result.Success(dto);
    }
}
