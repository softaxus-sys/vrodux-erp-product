using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Materialises real invoices from recurring-invoice templates. Used by both the
/// manual API trigger and the daily background job.
/// </summary>
public static class RecurringInvoiceGenerator
{
    /// <summary>Generate one invoice from a template for its current run date, then advance the schedule.</summary>
    public static Invoice GenerateInvoice(RecurringInvoice template, DateTime runDate)
    {
        var invoiceDate = runDate.ToString("yyyy-MM-dd");
        var dueDate     = runDate.AddDays(template.DueDays).ToString("yyyy-MM-dd");

        var note = string.IsNullOrWhiteSpace(template.Notes)
            ? $"Auto-generated from recurring template \"{template.TemplateName}\""
            : template.Notes;

        var invoice = new Invoice(template.CustomerName, template.CustomerEmail, invoiceDate, dueDate, template.TaxRate, note);
        foreach (var l in template.Lines)
            invoice.Items.Add(new InvoiceItem(invoice.Id, l.Description, l.Quantity, l.UnitPrice));

        return invoice;
    }

    /// <summary>Generate invoices for every template due on/before <paramref name="asOf"/>. Returns count created.</summary>
    public static async Task<int> GenerateDueAsync(FinanceDbContext db, DateTime asOf, CancellationToken ct = default)
    {
        var due = await db.RecurringInvoices
            .Include(r => r.Lines)
            .Where(r => r.IsActive && r.NextRunDate <= asOf
                     && (r.EndDate == null || r.NextRunDate <= r.EndDate))
            .ToListAsync(ct);

        var created = 0;
        foreach (var template in due)
        {
            // Catch up if several periods elapsed while the job was idle.
            var guard = 0;
            while (template.IsDue(asOf) && guard++ < 60)
            {
                var invoice = GenerateInvoice(template, template.NextRunDate);
                db.Invoices.Add(invoice);
                template.AdvanceAfterGeneration();
                created++;
            }
        }

        if (created > 0) await db.SaveChangesAsync(ct);
        return created;
    }
}
