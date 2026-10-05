using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringExpenses.Dtos;
using Softaxis.Finance.Application.RecurringExpenses.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringExpenses;

internal sealed class GetRecurringExpensesHandler(FinanceDbContext db)
    : IQueryHandler<GetRecurringExpensesQuery, IReadOnlyList<RecurringExpenseDto>>
{
    public async Task<Result<IReadOnlyList<RecurringExpenseDto>>> Handle(GetRecurringExpensesQuery query, CancellationToken ct)
    {
        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is applied by hand.
        var items = await db.RecurringExpenses.AsNoTracking()
            .Where(r => !r.IsDeleted)
            .OrderByDescending(r => r.IsActive)
            .ThenBy(r => r.NextRunDate)
            .ThenBy(r => r.Id)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<RecurringExpenseDto>>(
            items.Select(RecurringExpenseMappings.ToDto).ToList());
    }
}

internal sealed class GetRecurringExpenseByIdHandler(FinanceDbContext db)
    : IQueryHandler<GetRecurringExpenseByIdQuery, RecurringExpenseDto>
{
    public async Task<Result<RecurringExpenseDto>> Handle(GetRecurringExpenseByIdQuery query, CancellationToken ct)
    {
        var r = await db.RecurringExpenses.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);

        return r is null
            ? Result.Failure<RecurringExpenseDto>(Error.NotFoundById("RecurringExpense", query.Id))
            : Result.Success(RecurringExpenseMappings.ToDto(r));
    }
}
