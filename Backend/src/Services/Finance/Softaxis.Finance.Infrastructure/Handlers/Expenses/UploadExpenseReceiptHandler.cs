using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class UploadExpenseReceiptHandler(FinanceDbContext db) : ICommandHandler<UploadExpenseReceiptCommand>
{
    public async Task<Result> Handle(UploadExpenseReceiptCommand cmd, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([cmd.Id], ct);

        if (expense is null)
            return Result.Failure(Error.NotFoundById("Expense", cmd.Id));

        expense.SetReceipt(cmd.Data, cmd.FileName, cmd.ContentType);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
