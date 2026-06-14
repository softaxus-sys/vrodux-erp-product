using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class UpdatePurchaseBillHandler(FinanceDbContext db) : ICommandHandler<UpdatePurchaseBillCommand>
{
    public async Task<Result> Handle(UpdatePurchaseBillCommand cmd, CancellationToken ct)
    {
        var bill = await db.PurchaseBills.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (bill is null)
            return Result.Failure(Error.NotFoundById(nameof(PurchaseBill), cmd.Id));

        if (bill.Status is not ("draft" or "approved"))
            return Result.Failure(Error.Custom("PurchaseBill.Conflict", "Only draft or approved bills can be edited."));

        bill.Update(bill.SupplierName, cmd.BillDate, cmd.DueDate, cmd.TaxRate, cmd.Reference, cmd.Notes);

        db.PurchaseBillItems.RemoveRange(bill.Items);
        bill.Items.Clear();
        foreach (var item in cmd.Items)
            bill.Items.Add(new PurchaseBillItem(bill.Id, item.Description, item.Quantity, item.UnitPrice));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
