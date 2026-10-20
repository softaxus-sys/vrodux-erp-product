using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.RecurringExpenses.Dtos;

namespace Softaxis.Finance.Application.RecurringExpenses.Queries;

public sealed record GetRecurringExpensesQuery : IQuery<IReadOnlyList<RecurringExpenseDto>>;

public sealed record GetRecurringExpenseByIdQuery(Guid Id) : IQuery<RecurringExpenseDto>;
