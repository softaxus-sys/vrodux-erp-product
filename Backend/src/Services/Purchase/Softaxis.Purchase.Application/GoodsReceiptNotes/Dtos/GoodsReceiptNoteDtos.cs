namespace Softaxis.Purchase.Application.GoodsReceiptNotes.Dtos;

public sealed record GoodsReceiptNoteItemDto(
    Guid    Id,
    Guid?   PurchaseOrderItemId,
    Guid?   ProductId,
    string  Description,
    decimal OrderedQuantity,
    decimal ReceivedQuantity,
    decimal UnitCost,
    decimal LineTotal);

public sealed record GoodsReceiptNoteDto(
    Guid    Id,
    string  GrnNumber,
    Guid    PurchaseOrderId,
    string  PurchaseOrderNumber,
    Guid    VendorId,
    string  VendorName,
    string  GrnDate,
    string? DriverName,
    string? Notes,
    string  Status,
    IReadOnlyList<GoodsReceiptNoteItemDto> Items,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record GoodsReceiptNoteSummaryDto(
    Guid    Id,
    string  GrnNumber,
    Guid    PurchaseOrderId,
    string  PurchaseOrderNumber,
    Guid    VendorId,
    string  VendorName,
    string  GrnDate,
    string? DriverName,
    string  Status,
    int     ItemCount,
    DateTime CreatedAt);
