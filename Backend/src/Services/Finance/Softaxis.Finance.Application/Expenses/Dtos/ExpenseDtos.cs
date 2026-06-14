namespace Softaxis.Finance.Application.Expenses.Dtos;

public sealed record ExpenseDto(
    Guid      Id,
    string    ExpenseNumber,
    string    Title,
    string    Category,
    decimal   Amount,
    string    ExpenseDate,
    string?   PaidBy,
    string?   PaymentMethod,
    string?   Reference,
    string?   Notes,
    string    Status,
    Guid?     ApprovedById,
    DateTime? ApprovedAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt,
    bool      HasReceipt,
    string?   ReceiptFileName);

/// <summary>Raw receipt file bytes for streaming back to the client.</summary>
public sealed record ExpenseReceiptDto(byte[] Data, string FileName, string ContentType);

public sealed record ExpensesSummaryDto(
    int     Total,
    int     Draft,
    int     Pending,
    int     Approved,
    int     Rejected,
    int     Paid,
    decimal TotalAmount,
    decimal TotalPaid,
    int     PendingApproval);

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items, int Page, int PageSize,
    int TotalCount, int TotalPages, bool HasNext, bool HasPrev);
