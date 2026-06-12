using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class ApprovePurchaseBillHandler(FinanceDbContext db) : ICommandHandler<ApprovePurchaseBillCommand>
{
    public async Task<Result> Handle(ApprovePurchaseBillCommand cmd, CancellationToken ct)
    {
        var bill = await db.PurchaseBills.FindAsync([cmd.Id], ct);

        if (bill is null)
            return Result.Failure(Error.NotFoundById(nameof(PurchaseBill), cmd.Id));

        if (bill.Status != "draft")
            return Result.Failure(Error.Custom("PurchaseBill.Conflict", "Only draft bills can be approved."));

        bill.Approve();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
