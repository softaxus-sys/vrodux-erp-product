using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

/// <summary>
/// Settles an invoice in full.
///
/// <para>This used to flip <c>Status</c> to "paid" and nothing else: it never set
/// <c>AmountPaid</c> (so the invoice still reported its full amount as due) and it never posted to
/// the general ledger (so Accounts Receivable was never relieved and the cash was never recorded —
/// the books still showed the customer owing the money). It now records the payment and posts the
/// matching cash-receipt entry, the same way <c>PostReceiptVoucherHandler</c> does.</para>
///
/// <para>Use a <b>receipt voucher</b> for partial payments, a specific payment method/date, or
/// receipts covering several invoices. This is the one-click "settle it in full, today, to the
/// bank account" shortcut.</para>
/// </summary>
internal sealed class MarkInvoicePaidHandler(
    FinanceDbContext db,
    IFinanceEmailService email,
    ILogger<MarkInvoicePaidHandler> logger) : ICommandHandler<MarkInvoicePaidCommand>
{
    public async Task<Result> Handle(MarkInvoicePaidCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        if (invoice.Status == "paid")
            return Result.Failure(Error.Custom("Invoice.Conflict", "Invoice is already paid."));

        if (invoice.Status == "cancelled")
            return Result.Failure(Error.Custom("Invoice.Conflict", "A cancelled invoice cannot be marked paid."));

        // A draft has never been sent, so no receivable exists to relieve — crediting AR here would
        // post a payment against a sale the ledger has never seen. Send it first.
        if (invoice.Status == "draft")
            return Result.Failure(Error.Custom("Invoice.Conflict", "Send the invoice before marking it paid."));

        var outstanding = invoice.AmountDue;
        if (outstanding <= 0)
            return Result.Failure(Error.Custom("Invoice.Conflict", "Invoice has no outstanding balance."));

        var settlementDate = DateTime.UtcNow.ToString("yyyy-MM-dd");
        if (await GlPoster.IsPeriodClosedAsync(db, settlementDate, ct))
            return Result.Failure(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {settlementDate} is closed for posting."));

        invoice.RecordPayment(outstanding);

        // No payment method is captured on this command, so settle to the bank account —
        // ResolveCashAccount(null) returns Bank. A receipt voucher is the route for cash-in-hand.
        var cashAccount = GlPoster.ResolveCashAccount(null);

        // AR was raised at the invoice-date rate, so relieve it at that same rate; the cash leg is
        // valued at today's rate. Any difference is a realised FX gain/loss, mirroring
        // PostReceiptVoucherHandler.
        var invoiceRate    = await GlPoster.GetRateAsync(db, invoice.CurrencyCode, invoice.InvoiceDate, ct);
        var settlementRate = await GlPoster.GetRateAsync(db, invoice.CurrencyCode, settlementDate, ct);

        var arAed   = outstanding * invoiceRate;
        var cashAed = outstanding * settlementRate;

        var lines = new List<GlPoster.Line>
        {
            new(cashAccount, cashAed, 0, $"Payment received - Invoice {invoice.InvoiceNumber}"),
            new(GlPoster.AccountsReceivable, 0, arAed, $"AR settled - Invoice {invoice.InvoiceNumber}"),
        };

        var fx = cashAed - arAed;
        if (fx > 0)
            lines.Add(new(GlPoster.FxGainLoss, 0, fx, $"FX Gain - Invoice {invoice.InvoiceNumber}"));
        else if (fx < 0)
            lines.Add(new(GlPoster.FxGainLoss, -fx, 0, $"FX Loss - Invoice {invoice.InvoiceNumber}"));

        var journalEntryId = await GlPoster.PostAsync(
            db, settlementDate, $"Payment - Invoice {invoice.InvoiceNumber}", invoice.InvoiceNumber, lines, ct);
        invoice.SetPaymentJournalEntryId(journalEntryId);

        await db.SaveChangesAsync(ct);

        await SendReceiptAsync(invoice, outstanding, settlementDate, ct);

        return Result.Success();
    }

    /// <summary>
    /// Emails the customer their payment receipt, copying the workspace's CC list.
    ///
    /// Best-effort and deliberately after the commit: the money is recorded and the ledger posted
    /// either way. A mail server being down must never fail a payment that has already happened,
    /// and re-sending a receipt is trivial where un-recording a payment is not.
    /// </summary>
    private async Task SendReceiptAsync(
        Invoice invoice, decimal amountReceived, string receivedOn, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(invoice.CustomerEmail)) return;

        try
        {
            var branding = await RecurringInvoiceGenerator.ResolveBrandingAsync(db, ct);
            var body = PaymentReceiptEmailTemplate.Build(
                invoice, branding, amountReceived, receivedOn, method: null);

            var sent = await email.SendInvoiceAsync(
                invoice.CustomerEmail!, invoice.CustomerName, branding.CcList,
                body.Subject, body.Html, body.InlineImages,
                // The paid invoice travels with its receipt — the PDF renders a PAID mark,
                // so the customer files one document showing both the charge and that it is settled.
                InvoicePdfBuilder.TryBuildAttachment(invoice, branding), ct);

            // Recorded only on a real send, so the invoice never claims a receipt nobody received.
            if (sent)
            {
                invoice.RecordReceiptSent(invoice.CustomerEmail!);
                await db.SaveChangesAsync(ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Payment recorded for invoice {InvoiceNumber}, but the receipt email failed.",
                invoice.InvoiceNumber);
        }
    }
}
