using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IProductRepository
{
    Task<PagedResult<Product>> GetPagedAsync(
        int page, int pageSize,
        string? search, Guid? categoryId, bool? isActive, bool? isLowStock,
        CancellationToken ct = default);

    Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool>     CategoryExistsAsync(Guid categoryId, CancellationToken ct = default);

    void Add(Product product);

    // ── POS-catalogue rows ────────────────────────────────────────────────────
    //
    // The Inventory product list is a UNION of [inventory].[products] and [pos].[products]
    // (see ProductReadService), so a row on that screen may have no inventory row at all.
    // Every write below went through GetByIdAsync first and therefore returned 404 for those
    // rows — visible in the list, impossible to edit. These operate on the POS row directly,
    // the same way StockMovementRepository.AdjustPosProductStockAsync already does.
    //
    // Each returns false when no row matched, so a genuinely unknown id is still a 404.

    Task<bool> UpdatePosProductAsync(PosProductUpdate update, CancellationToken ct = default);
    Task<bool> SetPosProductActiveAsync(Guid id, bool isActive, CancellationToken ct = default);
    Task<bool> SoftDeletePosProductAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// The subset of an inventory product edit that [pos].[products] can actually store.
///
/// It has no BrandId or UnitOfMeasureId column, so those two are dropped for a POS-catalogue
/// item — stated here rather than silently discarded at the call site.
/// </summary>
public sealed record PosProductUpdate(
    Guid    Id,
    string  Name,
    string? Description,
    string? SKU,
    string? Barcode,
    Guid    CategoryId,
    decimal SalePrice,
    decimal CostPrice,
    decimal TaxRate,
    string  Unit,
    decimal ReorderLevel,
    bool    TrackInventory,
    string? ImageUrl);
