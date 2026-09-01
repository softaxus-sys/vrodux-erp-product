using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>What one generation run did, so the caller can report it rather than guess.</summary>
public sealed record RecurringRunResult(int Created, int Emailed, int EmailFailed);

/// <summary>
/// The issuing company as it should appear on an invoice, read from Settings → General → Company.
/// Mirrors the frontend's CompanyBranding so the printed and emailed copies match.
/// </summary>
public sealed record InvoiceBranding(
    string  Name,
    string? Address,
    string? Phone,
    string? Email,
    string? Website,
    string? TaxNumber,
    string? RegistrationNo,
    string? LogoUrl,
    string? SignatureUrl,
    string? StampUrl,
    // Workspace-wide addresses copied on invoice and receipt emails, from Settings → General →
    // Company. A one-off invoice has no recurring template to take a CC from, so without this a
    // receipt would reach the customer and nobody internally.
    string? CcEmails = null,
    // Remittance details, from the same Settings → General → Company block. An invoice that does
    // not say where to pay makes the customer ask, so this is printed on the document and the PDF
    // whenever any of it is filled in. All optional: a workspace that takes payment by card or cash
    // simply leaves them blank and the block is omitted entirely rather than printed empty.
    string? BankName = null,
    string? BankAccountName = null,
    string? BankAccountNumber = null,
    string? BankIban = null,
    string? BankSwift = null,
    string? BankBranch = null)
{
    /// <summary>Split on comma or semicolon and de-duplicated.</summary>
    public IReadOnlyList<string> CcList =>
        (CcEmails ?? string.Empty)
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    /// <summary>True when there is at least one bank detail worth printing. A workspace that takes
    /// payment by card or cash leaves them blank, and the block is omitted rather than shown empty.</summary>
    public bool HasBankDetails =>
        !string.IsNullOrWhiteSpace(BankName)          || !string.IsNullOrWhiteSpace(BankAccountName)
     || !string.IsNullOrWhiteSpace(BankAccountNumber) || !string.IsNullOrWhiteSpace(BankIban)
     || !string.IsNullOrWhiteSpace(BankSwift)         || !string.IsNullOrWhiteSpace(BankBranch);
};

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

        var branding = await ResolveBrandingAsync(db, ct);

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
                if (await SendInvoiceAsync(db, invoice, template.CcList, template.CcEmails, email, ct, branding))
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
        IFinanceEmailService email, CancellationToken ct, InvoiceBranding? branding = null)
    {
        if (string.IsNullOrWhiteSpace(invoice.CustomerEmail)) return false;

        branding ??= await ResolveBrandingAsync(db, ct);

        // The customer's own people come along too — their accounts inbox is usually who actually
        // pays, and copying only our side means the invoice lands with one person who forwards it.
        var (allCc, allCcRaw) = await MergeCustomerCcAsync(
            db, invoice.CustomerId, cc.Concat(invoice.CcList).ToList(), ct);

        var body = InvoiceEmailTemplate.Build(invoice, branding);

        // The PDF the customer files. Best-effort — see TryBuildAttachment.
        var attachments = InvoicePdfBuilder.TryBuildAttachment(invoice, branding);

        var sent = await email.SendInvoiceAsync(
            invoice.CustomerEmail!, invoice.CustomerName, allCc, body.Subject, body.Html,
            body.InlineImages, attachments, ct);

        // Recorded only on a real send. Marking it "sent" after a failure would show delivered for
        // something nobody received — the one thing this must never claim.
        if (sent) invoice.RecordEmailSent(invoice.CustomerEmail!, allCcRaw);

        return sent;
    }

    /// <summary>
    /// Unions the workspace CC list (our side) with the customer's own standing CC list (their
    /// side), de-duplicated case-insensitively so a shared address is not copied twice.
    ///
    /// <para>Resolved at send time from the customer record rather than snapshotted onto the
    /// invoice, so correcting a customer's contacts fixes every future send. An invoice with no
    /// linked customer (free-text name) simply gets no customer CC — matching by name would copy
    /// the wrong company on a near-miss.</para>
    /// </summary>
    public static async Task<(IReadOnlyList<string> Cc, string? CcRaw)> MergeCustomerCcAsync(
        FinanceDbContext db, Guid? customerId, IReadOnlyList<string> baseCc, CancellationToken ct)
    {
        // The raw string is always rebuilt from the final list, never passed through: it is what
        // gets recorded as "who we copied", so it must match what actually went out.
        var deduped = baseCc.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        string? Raw(IReadOnlyList<string> l) => l.Count == 0 ? null : string.Join(", ", l);

        if (customerId is null) return (deduped, Raw(deduped));

        var customerCc = await db.Customers.AsNoTracking()
            .Where(c => c.Id == customerId && !c.IsDeleted)
            .Select(c => c.CcEmails)
            .FirstOrDefaultAsync(ct);

        if (string.IsNullOrWhiteSpace(customerCc)) return (deduped, Raw(deduped));

        var merged = deduped
            .Concat(customerCc.Split([',', ';'],
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return (merged, Raw(merged));
    }

    private sealed class SettingRow
    {
        public string SettingKey { get; set; } = string.Empty;
        public string? Value     { get; set; }
    }

    /// <summary>
    /// The letterhead, read from the same Settings → General → Company block the printed invoice
    /// uses — so the emailed and printed copies of one invoice cannot disagree about who issued it.
    ///
    /// Cross-schema read: every service points at the same physical database, different schema.
    /// <c>identity</c> is a RESERVED SQL Server keyword and MUST be bracketed. <c>UserId IS NULL</c>
    /// selects the company-wide value rather than someone's personal override.
    /// </summary>
    public static async Task<InvoiceBranding> ResolveBrandingAsync(FinanceDbContext db, CancellationToken ct)
    {
        var tenantId = TenantAmbient.TenantId ?? Guid.Empty;
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            var rows = await db.Database
                .SqlQuery<SettingRow>($"""
                    SELECT [Key] AS SettingKey, [Value]
                    FROM [identity].[app_settings]
                    WHERE [Category] = 'company' AND [TenantId] = {tenantId} AND [UserId] IS NULL
                    """)
                .ToListAsync(ct);

            foreach (var r in rows.Where(r => !string.IsNullOrWhiteSpace(r.Value)))
                map[r.SettingKey] = r.Value!.Trim();
        }
        catch
        {
            // Settings are optional; the workspace name below is a perfectly good letterhead.
        }

        var name = Pick(map, "legalName", "name");

        if (string.IsNullOrWhiteSpace(name))
        {
            try
            {
                var rows = await db.Database
                    .SqlQuery<string?>($"SELECT [Name] FROM [identity].[tenants] WHERE [Id] = {tenantId}")
                    .ToListAsync(ct);
                name = rows.FirstOrDefault();
            }
            catch
            {
                // A lookup failure must not stop invoicing; the email carries a neutral sender name.
            }
        }

        return new InvoiceBranding(
            string.IsNullOrWhiteSpace(name) ? "Accounts" : name!,
            Pick(map, "address"), Pick(map, "phone"), Pick(map, "email"), Pick(map, "website"),
            Pick(map, "taxNumber"), Pick(map, "registrationNo"),
            Pick(map, "logoUrl"), Pick(map, "signatureUrl"), Pick(map, "stampUrl"),
            Pick(map, "invoiceCcEmails"),
            Pick(map, "bankName"), Pick(map, "bankAccountName"), Pick(map, "bankAccountNumber"),
            Pick(map, "bankIban"), Pick(map, "bankSwift"), Pick(map, "bankBranch"));
    }

    private static string? Pick(Dictionary<string, string> map, params string[] keys)
    {
        foreach (var k in keys)
            if (map.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v)) return v;
        return null;
    }
}
