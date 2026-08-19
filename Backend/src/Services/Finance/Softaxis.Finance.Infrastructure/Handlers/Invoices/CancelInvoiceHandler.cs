using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class CancelInvoiceHandler(FinanceDbContext db) : ICommandHandler<CancelInvoiceCommand>
{
    public async Task<Result> Handle(CancelInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([cmd.Id], ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        if (await GlPoster.IsPeriodClosedAsync(db, invoice.InvoiceDate, ct))
            return Result.Failure(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {invoice.InvoiceDate} is closed for posting."));

        // Reverse BOTH legs: the sales entry raised on send, and the cash-receipt entry if the
        // invoice was settled. Voiding only the sales entry would leave the cash side stranded in
        // the ledger, permanently unbalancing AR.
        await GlPoster.VoidAsync(db, invoice.JournalEntryId, ct);
        await GlPoster.VoidAsync(db, invoice.PaymentJournalEntryId, ct);
        invoice.SetJournalEntryId(null);
        invoice.SetPaymentJournalEntryId(null);
        invoice.Cancel();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
