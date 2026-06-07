using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IStockMovementRepository
{
    Task<PagedResult<StockMovement>> GetPagedAsync(
        int page, int pageSize,
        Guid? productId, string? movementType,
        DateTime? from, DateTime? to, Guid? warehouseId,
        CancellationToken ct = default);

    Task<Product?> GetTrackedProductAsync(Guid productId, CancellationToken ct = default);

    /// <summary>Returns the tracked per-warehouse stock row, creating it (unsaved) if absent.</summary>
    Task<ProductStock> GetOrCreateStockAsync(Guid productId, Guid warehouseId, CancellationToken ct = default);

    /// <summary>Returns the tracked batch row, creating it (unsaved) if absent.</summary>
    Task<ProductBatch> GetOrCreateBatchAsync(Guid productId, Guid warehouseId, string batchNumber, decimal costPrice, CancellationToken ct = default);

    void Add(StockMovement movement);
}
