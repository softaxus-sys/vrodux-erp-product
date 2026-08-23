using System.Text.Json.Serialization;
using Softaxis.BuildingBlocks.Application.Serialization;
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
    // Calendar date, not an instant — the frontend sends/reads it as yyyy-MM-dd. See
    // CalendarDateJsonConverter for why it must not be stamped UTC.
    [property: JsonConverter(typeof(NullableCalendarDateJsonConverter))] DateTime? ExpiryDate,
    int?      DaysToExpiry,
    decimal   Quantity,
    string    Status);
