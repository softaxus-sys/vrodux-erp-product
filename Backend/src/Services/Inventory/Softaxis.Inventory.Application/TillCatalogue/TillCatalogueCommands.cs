using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.TillCatalogue;

// The POS product screens keep their own API and their own shapes. For a workspace whose catalogue
// lives in Inventory they call these commands instead of writing to pos.products. The rules are the
// till's, not Inventory's screen rules: a barcode or SKU already in use is refused with the same codes
// the till has always returned, a barcode over 50 characters is refused, and stock cannot go negative.

public sealed record TillCreateProductCommand(
    string   Name,
    string?  Description,
    string?  SKU,
    string?  Barcode,
    Guid     CategoryId,
    decimal  SalePrice,
    decimal  CostPrice,
    decimal  TaxRate,
    string   Unit,
    decimal  OpeningStock,
    decimal  ReorderLevel,
    bool     TrackInventory,
    string?  ImageUrl) : ICommand<ProductDto>;

/// <summary>The till's product form has no brand or unit-of-measure; those are left exactly as they are.</summary>
public sealed record TillUpdateProductCommand(
    Guid     Id,
    string   Name,
    string?  Description,
    string?  SKU,
    string?  Barcode,
    Guid     CategoryId,
    decimal  SalePrice,
    decimal  CostPrice,
    decimal  TaxRate,
    string   Unit,
    decimal  ReorderLevel,
    bool     TrackInventory,
    string?  ImageUrl,
    bool     IsActive) : ICommand<ProductDto>;

/// <param name="Quantity">Signed: negative removes stock.</param>
/// <param name="AdjustmentType">Purchase, Sale, Return, Damage, StockTake, Opening or Transfer.</param>
/// <param name="BranchId">Adjust this branch's own warehouse instead of head-office stock.</param>
public sealed record TillAdjustStockCommand(
    Guid    ProductId,
    decimal Quantity,
    string  AdjustmentType,
    string? Reference,
    string? Notes,
    Guid?   BranchId) : ICommand<TillStockAdjustmentDto>;

public sealed record TillStockAdjustmentDto(
    Guid     MovementId,
    Guid     ProductId,
    string   ProductName,
    string   AdjustmentType,
    decimal  Quantity,
    decimal  BalanceAfter,
    string?  Reference,
    DateTime CreatedAt,
    string?  Notes);

public sealed record TillImportRow(string Name, string Barcode, string Category);

/// <summary>A bundled catalogue pack: products arrive at price 0 — the pack knows what a product IS.</summary>
public sealed record TillImportProductsCommand(
    IReadOnlyList<TillImportRow> Rows,
    decimal TaxRate,
    bool    TrackInventory) : ICommand<TillImportResultDto>;

public sealed record TillImportResultDto(int Imported, int Existing, int Invalid, int CategoriesCreated);
