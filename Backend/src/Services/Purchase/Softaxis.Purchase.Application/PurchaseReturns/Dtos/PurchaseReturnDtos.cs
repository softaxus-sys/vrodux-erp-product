namespace Softaxis.Purchase.Application.PurchaseReturns.Dtos;

public sealed record PurchaseReturnItemDto(
    Guid    Id,
    Guid?   PurchaseOrderItemId,
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitCost,
    decimal LineTotal);

public sealed record PurchaseReturnDto(
    Guid    Id,
    string  ReturnNumber,
    Guid    PurchaseOrderId,
    string  PurchaseOrderNumber,
    Guid    VendorId,
    string  VendorName,
    string  ReturnDate,
    string  Reason,
    string? Notes,
    string  Status,
    decimal TotalAmount,
    IReadOnlyList<PurchaseReturnItemDto> Items,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PurchaseReturnSummaryDto(
    Guid    Id,
    string  ReturnNumber,
    Guid    PurchaseOrderId,
    string  PurchaseOrderNumber,
    Guid    VendorId,
    string  VendorName,
    string  ReturnDate,
    string  Reason,
    string  Status,
    decimal TotalAmount,
    int     ItemCount,
    DateTime CreatedAt);
