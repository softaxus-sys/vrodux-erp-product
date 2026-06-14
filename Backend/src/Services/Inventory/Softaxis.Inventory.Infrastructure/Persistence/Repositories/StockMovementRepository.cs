using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class StockMovementRepository(InventoryDbContext db) : IStockMovementRepository
{
    public async Task<PagedResult<StockMovement>> GetPagedAsync(
        int page, int pageSize,
        Guid? productId, string? movementType,
        DateTime? from, DateTime? to, Guid? warehouseId,
        CancellationToken ct = default)
    {
        IQueryable<StockMovement> query = db.StockMovements
            .AsNoTracking()
            .Include(x => x.Product)
            .Include(x => x.Warehouse);

        if (productId.HasValue)     query = query.Where(x => x.ProductId    == productId.Value);
        if (!string.IsNullOrWhiteSpace(movementType))
                                    query = query.Where(x => x.MovementType == movementType);
        if (from.HasValue)          query = query.Where(x => x.MovedAt >= from.Value);
        if (to.HasValue)            query = query.Where(x => x.MovedAt <= to.Value);
        if (warehouseId.HasValue)   query = query.Where(x => x.WarehouseId  == warehouseId.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.MovedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return PagedResult<StockMovement>.Create(items, total, page, pageSize);
    }

    public async Task<Product?> GetTrackedProductAsync(Guid productId, CancellationToken ct = default) =>
        await db.Products.FindAsync([productId], ct);

    public async Task<bool> AdjustPosProductStockAsync(Guid productId, decimal delta, CancellationToken ct = default)
    {
        var rows = await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE [pos].[products] SET StockQuantity = StockQuantity + {delta} WHERE Id = {productId} AND IsDeleted = 0",
            ct);
        return rows > 0;
    }

    public async Task<ProductStock> GetOrCreateStockAsync(Guid productId, Guid warehouseId, CancellationToken ct = default)
    {
        var existing = await db.ProductStocks
            .FirstOrDefaultAsync(x => x.ProductId == productId && x.WarehouseId == warehouseId, ct);
        if (existing is not null) return existing;

        var created = new ProductStock(productId, warehouseId);
        db.ProductStocks.Add(created);
        return created;
    }

    public async Task<ProductBatch> GetOrCreateBatchAsync(Guid productId, Guid warehouseId, string batchNumber, decimal costPrice, CancellationToken ct = default)
    {
        var existing = await db.ProductBatches
            .FirstOrDefaultAsync(x => x.ProductId == productId && x.WarehouseId == warehouseId && x.BatchNumber == batchNumber, ct);
        if (existing is not null) return existing;

        var created = new ProductBatch(productId, warehouseId, batchNumber, null, 0, costPrice);
        db.ProductBatches.Add(created);
        return created;
    }

    public void Add(StockMovement movement) => db.StockMovements.Add(movement);
}
