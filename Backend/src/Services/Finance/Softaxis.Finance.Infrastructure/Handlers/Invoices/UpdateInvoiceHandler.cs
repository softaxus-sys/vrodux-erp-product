using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

/// <summary>
/// Edits an invoice's details. Deliberately cannot move it through its lifecycle.
///
/// <para>This used to write whatever <c>Status</c> the caller sent — and the edit form's dropdown
/// offers "paid". Setting it that way posted nothing: no <c>AmountPaid</c>, no journal entry, no
/// closed-period check. The invoice read as paid while the ledger still showed the customer owing
/// the money, with no cash recorded anywhere. Every status that means something financial has a
/// dedicated action that also writes the ledger, so the edit path now refuses to change status at
/// all and names the action to use.</para>
///
/// <para>It also refuses to change the amount of an invoice that has already been posted. The
/// journal entry was written from the old total; silently editing the lines underneath it leaves
/// the ledger and the invoice disagreeing, with nothing to show which is right.</para>
/// </summary>
internal sealed class UpdateInvoiceHandler(FinanceDbContext db) : ICommandHandler<UpdateInvoiceCommand>
{
    /// <summary>The action that owns each status, for an error message that says what to do next.</summary>
    private static string ActionFor(string status) => status switch
    {
        "sent"           => "Use Send to issue it — that posts the sale to the ledger.",
        "paid"           => "Use Mark as Paid, or record a receipt voucher — that posts the cash to the ledger.",
        "partially_paid" => "Record a receipt voucher for the amount received — that posts the cash to the ledger.",
        "cancelled"      => "Use Cancel — that reverses the entries already posted.",
        _                => "Use the matching action on the invoice.",
    };

    public async Task<Result> Handle(UpdateInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        if (invoice.Status == "cancelled")
            return Result.Failure(Error.Custom("Invoice.Conflict",
                "A cancelled invoice cannot be edited."));

        // Status is owned by the actions that also post to the ledger. An edit that quietly moved
        // an invoice to "paid" produced a paid invoice and an untouched general ledger.
        var requested = (cmd.Status ?? invoice.Status).Trim();
        if (!string.Equals(requested, invoice.Status, StringComparison.OrdinalIgnoreCase))
            return Result.Failure(Error.Custom("Invoice.Conflict",
                $"An invoice's status cannot be changed by editing it. {ActionFor(requested.ToLowerInvariant())}"));

        // Once posted, the totals are in the ledger. Changing them here would desync the two.
        var posted = invoice.JournalEntryId is not null;
        if (posted)
        {
            var newSubTotal = cmd.Items.Sum(i => i.Quantity * i.UnitPrice);
            var newTotal    = newSubTotal + newSubTotal * cmd.TaxRate / 100m;

            // A cent of tolerance: the comparison is against a stored decimal, and refusing an
            // edit over a rounding artefact would be its own kind of wrong.
            if (Math.Abs(newTotal - invoice.Total) > 0.01m)
                return Result.Failure(Error.Custom("Invoice.Conflict",
                    $"This invoice has already been posted to the ledger for {invoice.Total:N2}. " +
                    "Cancel it and raise a new one, or issue a credit note — the amount cannot be edited in place."));
        }

        invoice.Update(cmd.CustomerName, cmd.CustomerEmail, cmd.InvoiceDate, cmd.DueDate,
            cmd.TaxRate, cmd.Notes, invoice.Status, cmd.CcEmails);

        db.InvoiceItems.RemoveRange(invoice.Items);
        invoice.Items.Clear();
        foreach (var item in cmd.Items)
            invoice.Items.Add(new InvoiceItem(invoice.Id, item.Description, item.Quantity, item.UnitPrice));

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
