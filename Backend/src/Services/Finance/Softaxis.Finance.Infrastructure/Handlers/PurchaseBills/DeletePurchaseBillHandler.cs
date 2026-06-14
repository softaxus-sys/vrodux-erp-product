using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class DeletePurchaseBillHandler(FinanceDbContext db) : ICommandHandler<DeletePurchaseBillCommand>
{
    public async Task<Result> Handle(DeletePurchaseBillCommand cmd, CancellationToken ct)
    {
        var bill = await db.PurchaseBills.FindAsync([cmd.Id], ct);

        if (bill is null)
            return Result.Failure(Error.NotFoundById(nameof(PurchaseBill), cmd.Id));

        if (bill.AmountPaid > 0)
            return Result.Failure(Error.Custom("PurchaseBill.HasTransactions", "Cannot delete a bill that has recorded payments."));

        bill.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
