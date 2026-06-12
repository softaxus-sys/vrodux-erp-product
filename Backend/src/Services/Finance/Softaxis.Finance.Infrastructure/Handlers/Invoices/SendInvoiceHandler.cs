using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class SendInvoiceHandler(FinanceDbContext db) : ICommandHandler<SendInvoiceCommand>
{
    public async Task<Result> Handle(SendInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        if (invoice.Status != "draft")
            return Result.Failure(Error.Custom("Invoice.Conflict", "Only draft invoices can be sent."));

        invoice.Send();

        var lines = new List<GlPoster.Line>
        {
            new(GlPoster.AccountsReceivable, invoice.Total, 0, $"Invoice {invoice.InvoiceNumber} - {invoice.CustomerName}"),
            new(GlPoster.SalesRevenue, 0, invoice.SubTotal, $"Sales - Invoice {invoice.InvoiceNumber}"),
        };
        if (invoice.TaxAmount > 0)
            lines.Add(new(GlPoster.VatPayable, 0, invoice.TaxAmount, $"VAT Output - Invoice {invoice.InvoiceNumber}"));

        var journalEntryId = await GlPoster.PostAsync(db, invoice.InvoiceDate, $"Sales Invoice {invoice.InvoiceNumber}", invoice.InvoiceNumber, lines, ct);
        invoice.SetJournalEntryId(journalEntryId);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
