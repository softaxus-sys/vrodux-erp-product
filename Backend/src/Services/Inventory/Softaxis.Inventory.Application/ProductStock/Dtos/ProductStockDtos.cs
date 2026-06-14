namespace Softaxis.Inventory.Application.ProductStock.Dtos;

public sealed record WarehouseStockDto(
    Guid    WarehouseId,
    string  WarehouseName,
    string? WarehouseCode,
    decimal Quantity,
    decimal ReorderLevel,
    bool    IsLowStock,
    bool    IsDefault);

public sealed record ProductStockSummaryDto(
    Guid                          ProductId,
    decimal                       TotalOnHand,
    IReadOnlyList<WarehouseStockDto> Warehouses);

public sealed record ProductBatchDto(
    Guid      Id,
    string    WarehouseName,
    string    BatchNumber,
    DateTime? ExpiryDate,
    int?      DaysToExpiry,
    decimal   Quantity,
    string    Status);
