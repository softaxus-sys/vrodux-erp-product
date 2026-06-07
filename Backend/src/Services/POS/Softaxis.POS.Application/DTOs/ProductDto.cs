namespace Softaxis.POS.Application.DTOs;

public sealed record ProductDto(
    Guid     Id,
    string   Name,
    string?  Description,
    string?  SKU,
    string?  Barcode,
    Guid     CategoryId,
    string   CategoryName,
    decimal  SalePrice,
    decimal  CostPrice,
    decimal  TaxRate,
    string   Unit,
    decimal  StockQuantity,
    decimal  ReorderLevel,
    bool     TrackInventory,
    bool     IsActive,
    bool      IsLowStock,
    string?   ImageUrl,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProductSummaryDto(
    Guid    Id,
    string  Name,
    string? SKU,
    string? Barcode,
    string  CategoryName,
    decimal SalePrice,
    decimal TaxRate,
    decimal StockQuantity,
    string  Unit,
    bool    IsActive,
    bool    IsLowStock);

public sealed record ProductCategoryDto(
    Guid     Id,
    string   Name,
    string?  Description,
    Guid?    ParentCategoryId,
    string?  ParentCategoryName,
    int      SortOrder,
    bool     IsActive,
    int      ProductCount);

public sealed record StockMovementDto(
    Guid     Id,
    Guid     ProductId,
    string   ProductName,
    string   AdjustmentType,
    decimal  Quantity,
    decimal  BalanceAfter,
    string?  Reference,
    DateTime CreatedAt,
    string?  Notes);
