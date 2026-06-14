namespace Softaxis.Inventory.Application.StockTransfers.Dtos;

public sealed record StockTransferItemDto(
    Guid    Id,
    string  StockItemId,
    string  ItemName,
    string  Sku,
    decimal Quantity,
    decimal UnitCost,
    decimal Total);

public sealed record StockTransferDto(
    Guid    Id,
    string  TransferNumber,
    string  FromWarehouseId,
    string  FromWarehouseName,
    string  ToWarehouseId,
    string  ToWarehouseName,
    string  Status,
    string  RequestedBy,
    string? ApprovedBy,
    string  RequestDate,
    string  ExpectedDate,
    string? ReceivedDate,
    IReadOnlyList<StockTransferItemDto> Items,
    decimal  TotalValue,
    string   Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record StockTransferSummaryDto(
    int     Total,
    int     Draft,
    int     Pending,
    int     InTransit,
    int     Received,
    int     Cancelled,
    decimal TotalValue);

public sealed record StockTransferItemRequestDto(
    string  StockItemId,
    string  ItemName,
    string  Sku,
    decimal Quantity,
    decimal UnitCost);

public sealed record CreateStockTransferRequest(
    string  FromWarehouseId,
    string  FromWarehouseName,
    string  ToWarehouseId,
    string  ToWarehouseName,
    string  RequestedBy,
    string  ExpectedDate,
    string? Notes,
    IReadOnlyList<StockTransferItemRequestDto> Items);

public sealed record ApproveStockTransferRequest(string By);
