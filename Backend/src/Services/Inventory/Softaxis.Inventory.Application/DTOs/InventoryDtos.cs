namespace Softaxis.Inventory.Application.DTOs;

public sealed record ProductSummaryDto(
    Guid      Id,
    string    Name,
    string?   SKU,
    string?   Barcode,
    Guid      CategoryId,
    string    CategoryName,
    Guid?     BrandId,
    string?   BrandName,
    Guid?     UnitOfMeasureId,
    string?   UnitOfMeasureSymbol,
    decimal   SalePrice,
    decimal   CostPrice,
    decimal   TaxRate,
    string    Unit,
    decimal   StockQuantity,
    decimal   ReorderLevel,
    bool      IsActive,
    bool      TrackInventory,
    bool      IsLowStock,
    string?   ImageUrl,
    DateTime  CreatedAt);

public sealed record ProductDto(
    Guid      Id,
    string    Name,
    string?   Description,
    string?   SKU,
    string?   Barcode,
    Guid      CategoryId,
    string    CategoryName,
    Guid?     BrandId,
    string?   BrandName,
    Guid?     UnitOfMeasureId,
    string?   UnitOfMeasureSymbol,
    decimal   SalePrice,
    decimal   CostPrice,
    decimal   TaxRate,
    string    Unit,
    decimal   StockQuantity,
    decimal   ReorderLevel,
    bool      IsActive,
    bool      TrackInventory,
    bool      IsLowStock,
    string?   ImageUrl,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record BrandDto(
    Guid      Id,
    string    Name,
    string?   Code,
    string?   Description,
    string?   LogoUrl,
    bool      IsActive,
    int       ProductCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record UnitOfMeasureDto(
    Guid      Id,
    string    Name,
    string    Symbol,
    string?   Description,
    bool      IsActive,
    int       ProductCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProductCategoryDto(
    Guid      Id,
    string    Name,
    string?   Code,
    string?   Description,
    string?   ParentId,
    bool      IsActive,
    int       ProductCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record WarehouseDto(
    Guid      Id,
    string    Name,
    string?   Code,
    string?   Address,
    string?   ContactPerson,
    string?   Phone,
    bool      IsActive,
    bool      IsDefault,
    int       MovementCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record StockMovementDto(
    Guid      Id,
    Guid      ProductId,
    string    ProductName,
    string?   ProductSKU,
    string    MovementType,
    decimal   Quantity,
    decimal   UnitCost,
    decimal   TotalCost,
    string?   Reference,
    string?   Notes,
    Guid?     WarehouseId,
    string?   WarehouseName,
    DateTime  MovedAt,
    DateTime  CreatedAt);
