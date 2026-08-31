using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>What one generation run did, so the caller can report it rather than guess.</summary>
public sealed record RecurringRunResult(int Created, int Emailed, int EmailFailed);

/// <summary>
/// Materialises real invoices from recurring-invoice templates. Used by both the manual API
/// trigger and the daily background job.
///
/// <para><b>Tenancy.</b> This must only ever be called with an ambient tenant resolved. The
/// background job previously called it with none, which meant two things at once: the global query
/// filter was bypassed so it saw EVERY workspace's templates, and <c>StampTenantId</c> was a no-op
/// so every invoice it created landed with <c>TenantId = NULL</c> — invisible to the very workspace
/// that owned the template. Ten of eleven invoices in the dev database are in exactly that state.
/// The job now loops one workspace at a time with the tenant set.</para>
/// </summary>
public static class RecurringInvoiceGenerator
{
    /// <summary>Generate one invoice from a template for its current run date.</summary>
    public static Invoice GenerateInvoice(RecurringInvoice template, DateTime runDate, string? currencyCode = null)
    {
        var invoiceDate = runDate.ToString("yyyy-MM-dd");
        var dueDate     = runDate.AddDays(template.DueDays).ToString("yyyy-MM-dd");

        var note = string.IsNullOrWhiteSpace(template.Notes)
            ? $"Auto-generated from recurring template \"{template.TemplateName}\""
            : template.Notes;

        var invoice = new Invoice(template.CustomerName, template.CustomerEmail, invoiceDate, dueDate, template.TaxRate, note);
        foreach (var l in template.Lines)
            invoice.Items.Add(new InvoiceItem(invoice.Id, l.Description, l.Quantity, l.UnitPrice));

        // Invoice defaults to AED. A workspace operating in another currency would otherwise have
        // every recurring invoice silently labelled in the wrong one.
        if (!string.IsNullOrWhiteSpace(currencyCode)) invoice.SetCurrencyCode(currencyCode!);

        return invoice;
    }

    /// <summary>
    /// Generate invoices for every template due on/before <paramref name="asOf"/>, emailing those
    /// whose template has auto-send switched on.
    /// </summary>
    public static async Task<RecurringRunResult> GenerateDueAsync(
        FinanceDbContext db, DateTime asOf,
        IFinanceEmailService? email = null,
        CancellationToken ct = default)
    {
        var due = await db.RecurringInvoices
            .Include(r => r.Lines)
            .Where(r => r.IsActive && !r.IsDeleted && r.NextRunDate <= asOf
                     && (r.EndDate == null || r.NextRunDate <= r.EndDate))
            .ToListAsync(ct);

        if (due.Count == 0) return new RecurringRunResult(0, 0, 0);

        var (companyName, currency) = await ResolveTenantAsync(db, ct);

        var created = 0;
        var toEmail = new List<(Invoice Invoice, RecurringInvoice Template)>();

        foreach (var template in due)
        {
            // Catch up if several periods elapsed while the job was idle.
            var guard = 0;
            while (template.IsDue(asOf) && guard++ < 60)
            {
                var invoice = GenerateInvoice(template, template.NextRunDate, currency);
                db.Invoices.Add(invoice);
                template.AdvanceAfterGeneration();
                created++;

                if (template.AutoSend && !string.IsNullOrWhiteSpace(template.CustomerEmail))
                    toEmail.Add((invoice, template));
            }
        }

        // Saved BEFORE sending. An invoice that exists but was not emailed can be re-sent; an email
        // sent for an invoice that failed to save is a bill the customer has and the books do not.
        await db.SaveChangesAsync(ct);

        var emailed = 0;
        var failed  = 0;

        if (email is not null)
        {
            foreach (var (invoice, template) in toEmail)
            {
                var body = InvoiceEmailTemplate.Build(invoice, companyName);
                var sent = await email.SendInvoiceAsync(
                    invoice.CustomerEmail!, invoice.CustomerName, template.CcList,
                    body.Subject, body.Html, ct);

                if (sent)
                {
                    // Only on a real send. Marking it "sent" after a failure would show delivered
                    // for something nobody received — the one thing this must never claim.
                    invoice.RecordEmailSent(invoice.CustomerEmail!, template.CcEmails);
                    emailed++;
                }
                else failed++;
            }

            if (emailed > 0) await db.SaveChangesAsync(ct);
        }

        return new RecurringRunResult(created, emailed, failed);
    }

    /// <summary>
    /// The workspace's display name and operating currency, for the email and the invoice.
    /// Cross-schema read: every service points at the same physical database, different schema.
    /// <c>identity</c> is a RESERVED SQL Server keyword and MUST be bracketed.
    /// </summary>
    private static async Task<(string CompanyName, string? Currency)> ResolveTenantAsync(
        FinanceDbContext db, CancellationToken ct)
    {
        try
        {
            var tenantId = TenantAmbient.TenantId ?? Guid.Empty;
            var rows = await db.Database
                .SqlQuery<TenantRow>($"SELECT [Name], [Currency] FROM [identity].[tenants] WHERE [Id] = {tenantId}")
                .ToListAsync(ct);

            var row = rows.FirstOrDefault();
            return (string.IsNullOrWhiteSpace(row?.Name) ? "Accounts" : row!.Name, row?.Currency);
        }
        catch
        {
            // A lookup failure must not stop invoicing; the email just carries a neutral sender name.
            return ("Accounts", null);
        }
    }

    private sealed record TenantRow(string? Name, string? Currency);
}
