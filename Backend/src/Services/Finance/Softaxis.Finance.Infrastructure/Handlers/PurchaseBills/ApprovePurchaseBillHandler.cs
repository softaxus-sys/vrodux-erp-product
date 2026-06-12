using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.PurchaseBills.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.PurchaseBills;

internal sealed class ApprovePurchaseBillHandler(FinanceDbContext db) : ICommandHandler<ApprovePurchaseBillCommand>
{
    public async Task<Result> Handle(ApprovePurchaseBillCommand cmd, CancellationToken ct)
    {
        var bill = await db.PurchaseBills.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (bill is null)
            return Result.Failure(Error.NotFoundById(nameof(PurchaseBill), cmd.Id));

        if (bill.Status != "draft")
            return Result.Failure(Error.Custom("PurchaseBill.Conflict", "Only draft bills can be approved."));

        bill.Approve();

        var rate = await GlPoster.GetRateAsync(db, bill.CurrencyCode, bill.BillDate, ct);
        var lines = new List<GlPoster.Line>
        {
            new(GlPoster.Purchases, bill.SubTotal * rate, 0, $"Purchase Bill {bill.BillNumber} - {bill.SupplierName}"),
        };
        if (bill.TaxAmount > 0)
            lines.Add(new(GlPoster.VatPayable, bill.TaxAmount * rate, 0, $"VAT Input - Bill {bill.BillNumber}"));
        lines.Add(new(GlPoster.AccountsPayable, 0, bill.Total * rate, $"AP - Bill {bill.BillNumber}"));

        var journalEntryId = await GlPoster.PostAsync(db, bill.BillDate, $"Purchase Bill {bill.BillNumber}", bill.BillNumber, lines, ct);
        bill.SetJournalEntryId(journalEntryId);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
