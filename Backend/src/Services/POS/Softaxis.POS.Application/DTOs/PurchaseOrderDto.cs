namespace Softaxis.POS.Application.DTOs;

public sealed record PurchaseOrderItemDto(
    Guid    Id,
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitCost,
    decimal TaxRate,
    decimal LineTotal);

public sealed record PurchaseOrderDto(
    Guid     Id,
    string   OrderNumber,
    Guid     VendorId,
    string   VendorName,
    string   Status,
    string?  Notes,
    string?  ExpectedDate,
    string?  ReceivedDate,
    decimal  SubTotal,
    decimal  TaxAmount,
    decimal  Total,
    List<PurchaseOrderItemDto> Items,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PurchaseOrderSummaryDto(
    Guid      Id,
    string    OrderNumber,
    Guid      VendorId,
    string    VendorName,
    string    Status,
    string?   ExpectedDate,
    string?   ReceivedDate,
    decimal   Total,
    int       ItemCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);
