using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class MarkExpensePaidHandler(FinanceDbContext db) : ICommandHandler<MarkExpensePaidCommand>
{
    public async Task<Result> Handle(MarkExpensePaidCommand cmd, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([cmd.Id], ct);

        if (expense is null)
            return Result.Failure(Error.NotFoundById("Expense", cmd.Id));

        if (expense.Status != "approved")
            return Result.Failure(Error.Custom("Expense.Conflict", "Only approved expenses can be marked as paid."));

        expense.MarkPaid();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
