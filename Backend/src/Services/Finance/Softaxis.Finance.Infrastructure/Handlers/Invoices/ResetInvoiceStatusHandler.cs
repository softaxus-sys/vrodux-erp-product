using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

/// <summary>
/// Returns an invoice to draft so it can be corrected and re-issued.
///
/// <para>Sending an invoice posts the sales entry, and settling it posts the cash-receipt entry, so
/// this cannot simply move the status back: it reverses both legs first, the same way
/// <c>CancelInvoiceHandler</c> does. Flipping the status alone would leave the receivable and the
/// cash in the ledger for an invoice that no longer claims either.</para>
/// </summary>
internal sealed class ResetInvoiceStatusHandler(FinanceDbContext db) : ICommandHandler<ResetInvoiceStatusCommand>
{
    public async Task<Result> Handle(ResetInvoiceStatusCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        if (invoice.Status == "draft")
            return Result.Failure(Error.Custom("Invoice.Conflict", "Invoice is already a draft."));

        if (await GlPoster.IsPeriodClosedAsync(db, invoice.InvoiceDate, ct))
            return Result.Failure(Error.Custom("FiscalPeriod.Locked",
                $"The fiscal period for {invoice.InvoiceDate} is closed for posting."));

        // A receipt voucher owns its allocation: it holds the amount applied and reverses it on void.
        // Zeroing the invoice here would leave the two disagreeing, and voiding the voucher afterwards
        // would reverse a payment that had already been removed. Send them to the voucher instead.
        var settledByVoucher = await (
            from allocation in db.ReceiptAllocations
            join voucher in db.ReceiptVouchers on allocation.ReceiptVoucherId equals voucher.Id
            where allocation.InvoiceId == cmd.Id && voucher.Status == "posted"
            select voucher.VoucherNumber).FirstOrDefaultAsync(ct);

        if (settledByVoucher is not null)
            return Result.Failure(Error.Custom("Invoice.Conflict",
                $"This invoice was settled by receipt voucher {settledByVoucher}. Void that voucher first — " +
                "resetting the invoice here would leave the voucher claiming a payment the invoice no longer has."));

        // Reverse BOTH legs, for the reason spelled out in CancelInvoiceHandler: voiding only the
        // sales entry strands the cash side and permanently unbalances AR.
        await GlPoster.VoidAsync(db, invoice.JournalEntryId, ct);
        await GlPoster.VoidAsync(db, invoice.PaymentJournalEntryId, ct);
        invoice.SetJournalEntryId(null);
        invoice.SetPaymentJournalEntryId(null);

        invoice.ResetToDraft();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
