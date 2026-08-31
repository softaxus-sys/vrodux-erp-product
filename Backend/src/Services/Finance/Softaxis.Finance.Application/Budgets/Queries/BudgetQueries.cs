using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Finance.Application.Budgets.Dtos;

namespace Softaxis.Finance.Application.Budgets.Queries;

public sealed record GetBudgetsSummaryQuery : IQuery<BudgetsSummaryDto>;

// Budgets accumulate one row per department per period, so the list pages in SQL.
public sealed record GetBudgetsQuery(
    string? Period   = null,
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<BudgetListItemDto>>;

public sealed record GetBudgetByIdQuery(Guid Id) : IQuery<BudgetDto>;
