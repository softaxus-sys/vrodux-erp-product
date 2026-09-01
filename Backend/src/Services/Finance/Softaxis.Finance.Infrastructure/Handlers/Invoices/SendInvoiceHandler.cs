using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class SendInvoiceHandler(
    FinanceDbContext db,
    IFinanceEmailService email,
    ILogger<SendInvoiceHandler> logger) : ICommandHandler<SendInvoiceCommand, SendInvoiceResultDto>
{
    public async Task<Result<SendInvoiceResultDto>> Handle(SendInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (invoice is null)
            return Result.Failure<SendInvoiceResultDto>(Error.NotFoundById("Invoice", cmd.Id));

        if (invoice.Status != "draft")
            return Result.Failure<SendInvoiceResultDto>(Error.Custom("Invoice.Conflict", "Only draft invoices can be sent."));

        if (await GlPoster.IsPeriodClosedAsync(db, invoice.InvoiceDate, ct))
            return Result.Failure<SendInvoiceResultDto>(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {invoice.InvoiceDate} is closed for posting."));

        invoice.Send();

        var rate = await GlPoster.GetRateAsync(db, invoice.CurrencyCode, invoice.InvoiceDate, ct);
        var lines = new List<GlPoster.Line>
        {
            new(GlPoster.AccountsReceivable, invoice.Total * rate, 0, $"Invoice {invoice.InvoiceNumber} - {invoice.CustomerName}"),
            new(GlPoster.SalesRevenue, 0, invoice.SubTotal * rate, $"Sales - Invoice {invoice.InvoiceNumber}"),
        };
        if (invoice.TaxAmount > 0)
            lines.Add(new(GlPoster.VatPayable, 0, invoice.TaxAmount * rate, $"VAT Output - Invoice {invoice.InvoiceNumber}"));

        var journalEntryId = await GlPoster.PostAsync(db, invoice.InvoiceDate, $"Sales Invoice {invoice.InvoiceNumber}", invoice.InvoiceNumber, lines, ct);
        invoice.SetJournalEntryId(journalEntryId);

        // Committed BEFORE the email. An invoice that is posted but not emailed can be re-sent; an
        // email for an invoice that failed to save is a bill the customer holds and the books do not.
        await db.SaveChangesAsync(ct);

        // Actually email it. This handler previously did everything above and then simply returned —
        // so pressing Send marked the invoice "sent", posted the ledger, and dispatched nothing. The
        // invoice's own EmailSentAt stayed NULL, which is how it was caught.
        var emailSent = false;
        try
        {
            var branding = await RecurringInvoiceGenerator.ResolveBrandingAsync(db, ct);

            // Same helper the recurring job uses, so the manual and automatic sends produce the
            // identical email and the identical PDF attachment. It records EmailSentAt on success
            // only, so a failure never leaves the invoice claiming a delivery nobody received.
            emailSent = await RecurringInvoiceGenerator.SendInvoiceAsync(
                db, invoice, branding.CcList, branding.CcEmails, email, ct, branding);

            if (emailSent) await db.SaveChangesAsync(ct);
            else logger.LogWarning(
                "Invoice {InvoiceNumber} was issued and posted, but the email was not sent " +
                "(no customer address, or SMTP is unconfigured or refused it).", invoice.InvoiceNumber);
        }
        catch (Exception ex)
        {
            // The invoice is already issued and posted; a mail failure must not roll that back or
            // surface as a failed operation. It is reported to the caller instead.
            logger.LogError(ex, "Invoice {InvoiceNumber} was issued, but sending the email threw.",
                invoice.InvoiceNumber);
        }

        return Result.Success(new SendInvoiceResultDto(emailSent, emailSent ? invoice.CustomerEmail : null));
    }
}
