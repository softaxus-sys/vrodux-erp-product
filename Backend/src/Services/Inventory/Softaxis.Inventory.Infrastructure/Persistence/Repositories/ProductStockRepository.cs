using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class ProductStockRepository(InventoryDbContext db) : IProductStockRepository
{
    public async Task<IReadOnlyList<Warehouse>> GetActiveWarehousesAsync(CancellationToken ct = default) =>
        await db.Warehouses.AsNoTracking()
            .Where(w => !w.IsDeleted)
            .OrderByDescending(w => w.IsDefault).ThenBy(w => w.Name)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProductStock>> GetStocksByProductAsync(Guid productId, CancellationToken ct = default) =>
        await db.ProductStocks.AsNoTracking()
            .Where(s => s.ProductId == productId)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProductBatch>> GetBatchesByProductAsync(Guid productId, CancellationToken ct = default) =>
        await db.ProductBatches.AsNoTracking()
            .Include(b => b.Warehouse)
            .Where(b => b.ProductId == productId && b.Quantity > 0)
            .OrderBy(b => b.ExpiryDate)
            .ToListAsync(ct);
}
