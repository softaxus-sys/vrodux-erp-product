using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Application.Products.Queries.GetInventoryDashboard;

namespace Softaxis.Inventory.Application.Abstractions;

/// <summary>
/// Cross-schema read service that surfaces both Inventory and POS products
/// from the same SQL Server database (inventory.products UNION pos.products).
/// </summary>
public interface IProductReadService
{
    Task<PagedResult<ProductSummaryDto>> GetCombinedPagedAsync(
        int     page,
        int     pageSize,
        string? search     = null,
        Guid?   categoryId = null,
        bool?   isActive   = null,
        bool?   isLowStock = null,
        CancellationToken ct = default);

    /// <summary>
    /// Finds a single product by ID, looking in both pos.products and
    /// inventory.products. Returns null if not found in either schema.
    /// </summary>
    Task<ProductDto?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Finds a single product by barcode, looking in both schemas.
    /// Returns null if not found in either.
    /// </summary>
    Task<ProductDto?> GetByBarcodeAsync(string barcode, CancellationToken ct = default);

    /// <summary>
    /// Per-category stock counts and valuation for the dashboard, aggregated in SQL over the same
    /// union the list uses — so the charts and the product grid cannot disagree.
    /// </summary>
    Task<InventoryDashboardDto> GetDashboardAsync(CancellationToken ct = default);
}
