using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IProductStockRepository
{
    Task<IReadOnlyList<Warehouse>> GetActiveWarehousesAsync(CancellationToken ct = default);

    Task<IReadOnlyList<ProductStock>> GetStocksByProductAsync(Guid productId, CancellationToken ct = default);

    /// <summary>Returns batches with quantity &gt; 0 for a product, including their warehouse, ordered by expiry.</summary>
    Task<IReadOnlyList<ProductBatch>> GetBatchesByProductAsync(Guid productId, CancellationToken ct = default);
}
