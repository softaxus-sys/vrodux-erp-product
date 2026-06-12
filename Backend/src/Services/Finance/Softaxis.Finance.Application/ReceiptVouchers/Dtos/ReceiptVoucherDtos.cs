namespace Softaxis.Finance.Application.ReceiptVouchers.Dtos;

public sealed record ReceiptAllocationDto(
    Guid    Id,
    Guid    InvoiceId,
    string  InvoiceNumber,
    decimal InvoiceTotal,
    decimal AmountApplied);

public sealed record ReceiptAllocationRequest(
    Guid    InvoiceId,
    decimal AmountApplied);

public sealed record ReceiptVoucherSummaryDto(
    Guid      Id,
    string    VoucherNumber,
    Guid      CustomerId,
    string    CustomerName,
    string    ReceiptDate,
    decimal   Amount,
    string?   ReceiptMethod,
    string    Status,
    int       AllocationCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record ReceiptVoucherDto(
    Guid      Id,
    string    VoucherNumber,
    Guid      CustomerId,
    string    CustomerName,
    string    ReceiptDate,
    decimal   Amount,
    string?   ReceiptMethod,
    Guid?     BankAccountId,
    string?   Reference,
    string?   Notes,
    string    Status,
    IReadOnlyList<ReceiptAllocationDto> Allocations,
    DateTime? PostedAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items, int Page, int PageSize,
    int TotalCount, int TotalPages, bool HasNext, bool HasPrev);
