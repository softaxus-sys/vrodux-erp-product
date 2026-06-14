using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class UpdateExpenseHandler(FinanceDbContext db) : ICommandHandler<UpdateExpenseCommand>
{
    public async Task<Result> Handle(UpdateExpenseCommand cmd, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([cmd.Id], ct);

        if (expense is null)
            return Result.Failure(Error.NotFoundById("Expense", cmd.Id));

        if (expense.Status != "pending")
            return Result.Failure(Error.Custom("Expense.Conflict", "Only pending expenses can be edited."));

        expense.Update(cmd.Title, cmd.Category, cmd.Amount, cmd.ExpenseDate,
            cmd.PaidBy, cmd.PaymentMethod, cmd.Reference, cmd.Notes);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
