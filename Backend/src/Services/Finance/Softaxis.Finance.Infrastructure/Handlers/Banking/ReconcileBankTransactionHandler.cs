using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class ReconcileBankTransactionHandler(FinanceDbContext db) : ICommandHandler<ReconcileBankTransactionCommand>
{
    public async Task<Result> Handle(ReconcileBankTransactionCommand cmd, CancellationToken ct)
    {
        var txn = await db.BankTransactions.FindAsync([cmd.Id], ct);
        if (txn is null)
            return Result.Failure(Error.NotFoundById("BankTransaction", cmd.Id));

        txn.Reconcile();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
