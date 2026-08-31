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
    /// <summary>
    /// Generate one invoice from a template for its current run date.
    ///
    /// The currency is NOT set here: <c>Invoice.CurrencyCode</c> defaults through
    /// <c>TenantCurrency.Resolve()</c>, which reads the ambient tenant. The caller's job is to make
    /// sure that ambient context carries a currency — the background service does, per workspace.
    /// </summary>
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

        var companyName = await ResolveCompanyNameAsync(db, ct);

        var created = 0;
        var toEmail = new List<(Invoice Invoice, RecurringInvoice Template)>();

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
                if (await SendInvoiceAsync(db, invoice, template.CcList, template.CcEmails, email, ct, companyName))
                    emailed++;
                else
                    failed++;
            }

            if (emailed > 0) await db.SaveChangesAsync(ct);
        }

        return new RecurringRunResult(created, emailed, failed);
    }

    /// <summary>
    /// Emails one invoice and records the delivery on it. Does NOT save — the caller decides when,
    /// so a batch can write once rather than per message.
    /// </summary>
    /// <returns>true only if the mail server accepted it.</returns>
    public static async Task<bool> SendInvoiceAsync(
        FinanceDbContext db, Invoice invoice, IReadOnlyList<string> cc, string? ccRaw,
        IFinanceEmailService email, CancellationToken ct, string? companyName = null)
    {
        if (string.IsNullOrWhiteSpace(invoice.CustomerEmail)) return false;

        companyName ??= await ResolveCompanyNameAsync(db, ct);

        var body = InvoiceEmailTemplate.Build(invoice, companyName);
        var sent = await email.SendInvoiceAsync(
            invoice.CustomerEmail!, invoice.CustomerName, cc, body.Subject, body.Html, ct);

        // Recorded only on a real send. Marking it "sent" after a failure would show delivered for
        // something nobody received — the one thing this must never claim.
        if (sent) invoice.RecordEmailSent(invoice.CustomerEmail!, ccRaw);

        return sent;
    }

    /// <summary>
    /// The workspace's display name, used as the sender in the invoice email — a customer should
    /// see who is billing them, not a generic label.
    ///
    /// Cross-schema read: every service points at the same physical database, different schema.
    /// <c>identity</c> is a RESERVED SQL Server keyword and MUST be bracketed.
    /// </summary>
    private static async Task<string> ResolveCompanyNameAsync(FinanceDbContext db, CancellationToken ct)
    {
        try
        {
            var tenantId = TenantAmbient.TenantId ?? Guid.Empty;
            var rows = await db.Database
                .SqlQuery<string?>($"SELECT [Name] FROM [identity].[tenants] WHERE [Id] = {tenantId}")
                .ToListAsync(ct);

            var name = rows.FirstOrDefault();
            return string.IsNullOrWhiteSpace(name) ? "Accounts" : name!;
        }
        catch
        {
            // A lookup failure must not stop invoicing; the email just carries a neutral sender name.
            return "Accounts";
        }
    }
}
