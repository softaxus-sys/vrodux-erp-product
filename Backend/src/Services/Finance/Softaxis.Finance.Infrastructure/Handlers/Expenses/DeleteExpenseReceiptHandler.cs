using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class DeleteExpenseReceiptHandler(FinanceDbContext db) : ICommandHandler<DeleteExpenseReceiptCommand>
{
    public async Task<Result> Handle(DeleteExpenseReceiptCommand cmd, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([cmd.Id], ct);

        if (expense is null)
            return Result.Failure(Error.NotFoundById("Expense", cmd.Id));

        expense.ClearReceipt();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
