namespace Softaxis.Finance.Application.PurchaseBills.Dtos;

public sealed record PurchaseBillItemDto(
    Guid    Id,
    string  Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal LineTotal);

public sealed record PurchaseBillItemRequest(
    string  Description,
    decimal Quantity,
    decimal UnitPrice);

public sealed record PurchaseBillSummaryDto(
    Guid      Id,
    string    BillNumber,
    Guid      SupplierId,
    string    SupplierName,
    string    BillDate,
    string    DueDate,
    decimal   TaxRate,
    decimal   SubTotal,
    decimal   TaxAmount,
    decimal   Total,
    decimal   AmountPaid,
    decimal   AmountDue,
    string    Status,
    int       ItemCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PurchaseBillDto(
    Guid      Id,
    string    BillNumber,
    Guid      SupplierId,
    string    SupplierName,
    string    BillDate,
    string    DueDate,
    decimal   TaxRate,
    decimal   SubTotal,
    decimal   TaxAmount,
    decimal   Total,
    decimal   AmountPaid,
    decimal   AmountDue,
    string    Status,
    string?   Reference,
    string?   Notes,
    IReadOnlyList<PurchaseBillItemDto> Items,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PurchaseBillsSummaryDto(
    int     TotalBills,
    decimal TotalAmount,
    decimal TotalPaid,
    decimal TotalOutstanding,
    int     DraftCount,
    int     OutstandingCount);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items, int Page, int PageSize,
    int TotalCount, int TotalPages, bool HasNext, bool HasPrev);
