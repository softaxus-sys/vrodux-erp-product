using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.Products.Commands.DeleteProduct;
using Softaxis.Inventory.Application.TillCatalogue;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Catalogue.Commands;
using Softaxis.POS.Application.Catalogue.Dtos;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.Products.Commands.AdjustStock;
using Softaxis.POS.Application.Products.Commands.CreateProduct;
using Softaxis.POS.Application.Products.Commands.UpdateProduct;
using Softaxis.POS.Application.Products.Queries.GetProducts;
using Softaxis.POS.Infrastructure.Persistence;
using InvProduct = Softaxis.Inventory.Application.DTOs.ProductDto;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>
/// Serves the till's product screens from Inventory — the single source of truth for products and
/// stock — in the till's own shapes. The rules that live in Inventory (uniqueness, stock, warehouses)
/// are Inventory's <c>Till*</c> commands; this class only decides which catalogue a workspace is on
/// and translates between the two sets of DTOs.
/// </summary>
public sealed class InventoryCatalogueGateway(POSDbContext db, ISender sender, IProductReadService read)
    : ICatalogueGateway
{
    private bool? _usesInventory;

    /// <summary>
    /// A workspace is on Inventory when it has no live product of its own in the POS schema. The test is
    /// the data, not a flag, so a new workspace needs no setup and a workspace with existing POS
    /// products is untouched until they are moved. One cheap EXISTS per request.
    /// </summary>
    public async Task<bool> UsesInventoryAsync(CancellationToken ct = default)
    {
        if (_usesInventory is null) _usesInventory = !await db.Products.AsNoTracking().AnyAsync(ct);
        return _usesInventory.Value;
    }

    public async Task<Result<ProductDto>> CreateAsync(CreateProductCommand c, CancellationToken ct = default)
    {
        var r = await sender.Send(new TillCreateProductCommand(
            c.Name, c.Description, c.SKU, c.Barcode, c.CategoryId, c.SalePrice, c.CostPrice, c.TaxRate,
            c.Unit, c.OpeningStock, c.ReorderLevel, c.TrackInventory, c.ImageUrl), ct);
        return r.IsFailure ? Result.Failure<ProductDto>(r.Error) : Result.Success(ToPos(r.Value));
    }

    public async Task<Result<ProductDto>> UpdateAsync(UpdateProductCommand c, CancellationToken ct = default)
    {
        var r = await sender.Send(new TillUpdateProductCommand(
            c.Id, c.Name, c.Description, c.SKU, c.Barcode, c.CategoryId, c.SalePrice, c.CostPrice, c.TaxRate,
            c.Unit, c.ReorderLevel, c.TrackInventory, c.ImageUrl, c.IsActive), ct);
        return r.IsFailure ? Result.Failure<ProductDto>(r.Error) : Result.Success(ToPos(r.Value));
    }

    public async Task<Result> DeleteAsync(Guid id, CancellationToken ct = default) =>
        await sender.Send(new DeleteProductCommand(id), ct);

    public async Task<Result<ProductDto>> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var p = await read.GetByIdAsync(id, ct);
        return p is null ? Result.Failure<ProductDto>(Error.NotFoundById("Product", id)) : Result.Success(ToPos(p));
    }

    public async Task<Result<ProductSummaryDto>> GetByBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        var p = await read.GetByBarcodeAsync(barcode, ct);
        return p is null
            ? Result.Failure<ProductSummaryDto>(Error.Custom("Product.BarcodeNotFound", $"No product found with barcode '{barcode}'."))
            : Result.Success(new ProductSummaryDto(
                p.Id, p.Name, p.SKU, p.Barcode, p.CategoryName, p.SalePrice, p.TaxRate,
                p.StockQuantity, p.Unit, p.IsActive, p.IsLowStock));
    }

    public async Task<Result<PagedResult<ProductSummaryDto>>> GetPagedAsync(GetProductsQuery q, CancellationToken ct = default)
    {
        // The till's list was always ordered by name and its screens never send SortBy, so it is not
        // carried over: Inventory's read orders by name in SQL, which keeps paging correct.
        var page = await read.GetCombinedPagedAsync(
            q.Page, q.PageSize, q.Search, q.CategoryId, q.IsActive, q.LowStock, q.BranchId, ct);

        var items = page.Items.Select(p => new ProductSummaryDto(
            p.Id, p.Name, p.SKU, p.Barcode, p.CategoryName, p.SalePrice, p.TaxRate,
            p.StockQuantity, p.Unit, p.IsActive, p.IsLowStock)).ToList();
        return Result.Success(PagedResult<ProductSummaryDto>.Create(items, page.TotalCount, page.Page, page.PageSize));
    }

    public async Task<Result<StockMovementDto>> AdjustStockAsync(AdjustStockCommand c, CancellationToken ct = default)
    {
        var r = await sender.Send(new TillAdjustStockCommand(
            c.ProductId, c.Quantity, c.AdjustmentType, c.Reference, c.Notes, c.BranchId), ct);
        return r.IsFailure
            ? Result.Failure<StockMovementDto>(r.Error)
            : Result.Success(new StockMovementDto(
                r.Value.MovementId, r.Value.ProductId, r.Value.ProductName, r.Value.AdjustmentType,
                r.Value.Quantity, r.Value.BalanceAfter, r.Value.Reference, r.Value.CreatedAt, r.Value.Notes));
    }

    public async Task<Result<ImportCatalogueResultDto>> ImportAsync(
        ImportCatalogueCommand cmd, IReadOnlyList<CatalogueItem> rows, CancellationToken ct = default)
    {
        var r = await sender.Send(new TillImportProductsCommand(
            rows.Select(i => new TillImportRow(i.N, i.C, i.K)).ToList(), cmd.TaxRate, cmd.TrackInventory), ct);
        return r.IsFailure
            ? Result.Failure<ImportCatalogueResultDto>(r.Error)
            : Result.Success(new ImportCatalogueResultDto(r.Value.Imported, r.Value.Existing, r.Value.Invalid, r.Value.CategoriesCreated));
    }

    private static ProductDto ToPos(InvProduct p) => new(
        p.Id, p.Name, p.Description, p.SKU, p.Barcode, p.CategoryId, p.CategoryName,
        p.SalePrice, p.CostPrice, p.TaxRate, p.Unit, p.StockQuantity, p.ReorderLevel,
        p.TrackInventory, p.IsActive, p.IsLowStock, p.ImageUrl, p.CreatedAt, p.UpdatedAt);
}
