using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Catalogue.Commands;
using Softaxis.POS.Application.Catalogue.Dtos;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.Products.Commands.AdjustStock;
using Softaxis.POS.Application.Products.Commands.CreateProduct;
using Softaxis.POS.Application.Products.Commands.UpdateProduct;
using Softaxis.POS.Application.Products.Queries.GetProducts;

namespace Softaxis.POS.Application.Abstractions;

/// <summary>
/// The till's product screens talk to the product catalogue through here.
///
/// <para>Inventory is the single source of truth for products and stock. A workspace whose catalogue
/// lives in Inventory has its product screens served from it, with the same routes, shapes, permissions
/// and rules the till has always had. A workspace that still has products in the POS schema is left
/// exactly as it was until it is moved (see docs/product-catalogue-unification.md).</para>
/// </summary>
public interface ICatalogueGateway
{
    /// <summary>
    /// True when this workspace's catalogue is in Inventory: it has no live products of its own in the
    /// POS schema. A new workspace therefore starts on Inventory; one with existing POS products stays on
    /// them until moved. Decided once per request.
    /// </summary>
    Task<bool> UsesInventoryAsync(CancellationToken ct = default);

    Task<Result<ProductDto>> CreateAsync(CreateProductCommand cmd, CancellationToken ct = default);
    Task<Result<ProductDto>> UpdateAsync(UpdateProductCommand cmd, CancellationToken ct = default);
    Task<Result> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<Result<ProductDto>> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Result<ProductSummaryDto>> GetByBarcodeAsync(string barcode, CancellationToken ct = default);
    Task<Result<PagedResult<ProductSummaryDto>>> GetPagedAsync(GetProductsQuery query, CancellationToken ct = default);
    Task<Result<StockMovementDto>> AdjustStockAsync(AdjustStockCommand cmd, CancellationToken ct = default);
    Task<Result<ImportCatalogueResultDto>> ImportAsync(
        ImportCatalogueCommand cmd, IReadOnlyList<CatalogueItem> rows, CancellationToken ct = default);
}
