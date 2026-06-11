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
    DateTime? UpdatedAt);

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
