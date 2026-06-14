using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Expenses.Dtos;

namespace Softaxis.Finance.Application.Expenses.Queries;

public sealed record GetExpensesSummaryQuery : IQuery<ExpensesSummaryDto>;

public sealed record GetExpensesQuery(
    int Page, int PageSize, string? Search, string? Status,
    string? Category, string? DateFrom, string? DateTo) : IQuery<PagedResult<ExpenseDto>>;

public sealed record GetExpenseByIdQuery(Guid Id) : IQuery<ExpenseDto>;

public sealed record GetExpenseReceiptQuery(Guid Id) : IQuery<ExpenseReceiptDto>;
