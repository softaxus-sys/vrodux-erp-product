using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringExpenses.Commands;
using Softaxis.Finance.Application.RecurringExpenses.Dtos;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringExpenses;

internal sealed class GenerateRecurringExpenseNowHandler(FinanceDbContext db)
    : ICommandHandler<GenerateRecurringExpenseNowCommand, GenerateRecurringExpenseResultDto>
{
    public async Task<Result<GenerateRecurringExpenseResultDto>> Handle(GenerateRecurringExpenseNowCommand cmd, CancellationToken ct)
    {
        var r = await db.RecurringExpenses.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (r is null)
            return Result.Failure<GenerateRecurringExpenseResultDto>(Error.NotFoundById("RecurringExpense", cmd.Id));

        // Dated today, and it takes the place of the next scheduled run — pressing this on the
        // 28th for a charge due on the 1st must not book the same month twice.
        var outcome = await RecurringExpenseGenerator.GenerateAsync(db, r, DateTime.UtcNow.Date, ct);
        r.AdvanceAfterGeneration();
        await db.SaveChangesAsync(ct);

        return Result.Success(new GenerateRecurringExpenseResultDto(
            outcome.Expense.Id, outcome.Expense.ExpenseNumber, outcome.Expense.Status, outcome.Message));
    }
}

internal sealed class RunDueRecurringExpensesHandler(FinanceDbContext db)
    : ICommandHandler<RunDueRecurringExpensesCommand, RunDueRecurringExpensesResultDto>
{
    public async Task<Result<RunDueRecurringExpensesResultDto>> Handle(RunDueRecurringExpensesCommand cmd, CancellationToken ct)
    {
        var result = await RecurringExpenseGenerator.GenerateDueAsync(db, DateTime.UtcNow, ct);
        return Result.Success(new RunDueRecurringExpensesResultDto(result.Created, result.Posted, result.Held));
    }
}
