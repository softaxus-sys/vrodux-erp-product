using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Dtos;
using Softaxis.Finance.Application.Expenses.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class GetExpenseByIdHandler(FinanceDbContext db) : IQueryHandler<GetExpenseByIdQuery, ExpenseDto>
{
    public async Task<Result<ExpenseDto>> Handle(GetExpenseByIdQuery query, CancellationToken ct)
    {
        var expense = await db.Expenses.AsNoTracking()
            .Where(x => x.Id == query.Id)
            .Select(x => ExpenseMappings.ToDto(x))
            .FirstOrDefaultAsync(ct);

        if (expense is null)
            return Result.Failure<ExpenseDto>(Error.NotFoundById("Expense", query.Id));

        return Result.Success(expense);
    }
}
