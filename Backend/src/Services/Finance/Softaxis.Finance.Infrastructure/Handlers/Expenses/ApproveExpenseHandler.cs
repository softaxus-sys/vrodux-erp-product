using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class ApproveExpenseHandler(FinanceDbContext db) : ICommandHandler<ApproveExpenseCommand>
{
    public async Task<Result> Handle(ApproveExpenseCommand cmd, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([cmd.Id], ct);

        if (expense is null)
            return Result.Failure(Error.NotFoundById("Expense", cmd.Id));

        if (expense.Status != "pending")
            return Result.Failure(Error.Custom("Expense.Conflict", "Only pending expenses can be approved."));

        expense.Approve(cmd.ApproverId);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
