using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Budgets.Dtos;

namespace Softaxis.Finance.Application.Budgets.Queries;

public sealed record GetBudgetsSummaryQuery : IQuery<BudgetsSummaryDto>;

public sealed record GetBudgetsQuery(string? Period, string? Status) : IQuery<IReadOnlyList<BudgetListItemDto>>;

public sealed record GetBudgetByIdQuery(Guid Id) : IQuery<BudgetDto>;
