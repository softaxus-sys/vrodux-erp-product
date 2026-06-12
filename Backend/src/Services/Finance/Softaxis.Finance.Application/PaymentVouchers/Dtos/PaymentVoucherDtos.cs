namespace Softaxis.Finance.Application.PaymentVouchers.Dtos;

public sealed record PaymentAllocationDto(
    Guid    Id,
    Guid    BillId,
    string  BillNumber,
    decimal BillTotal,
    decimal AmountApplied);

public sealed record PaymentAllocationRequest(
    Guid    BillId,
    decimal AmountApplied);

public sealed record PaymentVoucherSummaryDto(
    Guid      Id,
    string    VoucherNumber,
    Guid      SupplierId,
    string    SupplierName,
    string    PaymentDate,
    decimal   Amount,
    string?   PaymentMethod,
    string    Status,
    int       AllocationCount,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PaymentVoucherDto(
    Guid      Id,
    string    VoucherNumber,
    Guid      SupplierId,
    string    SupplierName,
    string    PaymentDate,
    decimal   Amount,
    string?   PaymentMethod,
    Guid?     BankAccountId,
    string?   Reference,
    string?   Notes,
    string    Status,
    IReadOnlyList<PaymentAllocationDto> Allocations,
    DateTime? PostedAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items, int Page, int PageSize,
    int TotalCount, int TotalPages, bool HasNext, bool HasPrev);
