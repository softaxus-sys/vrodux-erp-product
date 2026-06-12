using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class CancelPurchaseBillHandler(FinanceDbContext db) : ICommandHandler<CancelPurchaseBillCommand>
{
    public async Task<Result> Handle(CancelPurchaseBillCommand cmd, CancellationToken ct)
    {
        var bill = await db.PurchaseBills.FindAsync([cmd.Id], ct);

        if (bill is null)
            return Result.Failure(Error.NotFoundById(nameof(PurchaseBill), cmd.Id));

        if (bill.Status is "paid" or "partially_paid")
            return Result.Failure(Error.Custom("PurchaseBill.Conflict", "Bills with recorded payments cannot be cancelled."));

        if (bill.Status == "cancelled")
            return Result.Failure(Error.Custom("PurchaseBill.Conflict", "Bill is already cancelled."));

        bill.Cancel();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
