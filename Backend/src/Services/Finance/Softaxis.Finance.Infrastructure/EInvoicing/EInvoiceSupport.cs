using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Application.EInvoicing;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.Infrastructure.EInvoicing;

public static class EInvoiceDocumentTypes
{
    public const string Invoice = "invoice";
    public const string CreditNote = "credit_note";
    public static bool IsKnown(string? t) => t is Invoice or CreditNote;
}

/// <summary>Default gateway: no provider is connected, so nothing is sent and the queue holds still.</summary>
internal sealed class UnavailableEInvoiceGateway : IEInvoiceGateway
{
    public string ProviderKey => "none";
    public bool IsAvailable => false;
    public string? UnavailableReason =>
        "No e-invoicing provider is connected yet. Documents can be checked and their XML downloaded; " +
        "nothing is sent until an Accredited Service Provider is connected.";

    public Task<EInvoiceSendResult> SendAsync(EInvoiceSendRequest request, CancellationToken ct) =>
        Task.FromResult(new EInvoiceSendResult(EInvoiceSendOutcome.NotAvailable, null, UnavailableReason));
}

internal sealed record LoadedEInvoice(EInvoiceDocument Document, string DocumentType, Guid DocumentId, string Number);

/// <summary>Turns an invoice or credit note into the neutral <see cref="EInvoiceDocument"/>. Read-only.</summary>
internal static class EInvoiceDocumentFactory
{
    public static async Task<LoadedEInvoice?> LoadAsync(FinanceDbContext db, string type, Guid id, CancellationToken ct)
    {
        if (type == EInvoiceDocumentTypes.Invoice)
        {
            var inv = await db.Invoices.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
            if (inv is null) return null;
            var lines = inv.Items.Select(i => ToLine(i.Description, i.Quantity, i.UnitPrice, i.TaxCategory, i.UnitCode, i.ExemptionReason, inv.TaxRate)).ToList();
            return await AssembleAsync(db, type, inv.Id, isCredit: false, inv.InvoiceNumber, inv.InvoiceDate, inv.DueDate, inv.CurrencyCode,
                inv.Notes, null, null, null, inv.CustomerId, inv.CustomerName, inv.CustomerAddress, inv.CustomerTrn, lines, ct);
        }

        if (type == EInvoiceDocumentTypes.CreditNote)
        {
            var cn = await db.CreditNotes.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
            if (cn is null) return null;
            var invDate = await db.Invoices.AsNoTracking().Where(x => x.Id == cn.InvoiceId).Select(x => x.InvoiceDate).FirstOrDefaultAsync(ct);
            var lines = cn.Items.Select(i => ToLine(i.Description, i.Quantity, i.UnitPrice, i.TaxCategory, i.UnitCode, i.ExemptionReason, cn.TaxRate)).ToList();
            return await AssembleAsync(db, type, cn.Id, isCredit: true, cn.CreditNoteNumber, cn.CreditDate, null, cn.CurrencyCode,
                cn.Notes, cn.Reason, cn.InvoiceNumber, invDate, cn.CustomerId, cn.CustomerName, cn.CustomerAddress, cn.CustomerTrn, lines, ct);
        }

        return null;
    }

    internal static EInvoiceParty BuyerFor(string name, string? address, string? trn, Customer? customer) =>
        new(name, Pick(trn, customer?.Trn), null, null, null,
            Pick(address, customer?.Address), customer?.City, customer?.Emirate, customer?.CountryCode, customer?.PeppolId);

    /// <summary>Builds an invoice's document from data already in memory. Lets the readiness check cover hundreds of invoices in a few queries.</summary>
    internal static EInvoiceDocument FromInvoice(Invoice inv, Customer? customer, EInvoiceParty supplier, decimal? aedRate) =>
        new(false, inv.InvoiceNumber, inv.InvoiceDate, inv.DueDate, inv.CurrencyCode.ToUpperInvariant(), aedRate, inv.Notes, null, null, null,
            supplier, BuyerFor(inv.CustomerName, inv.CustomerAddress, inv.CustomerTrn, customer),
            inv.Items.Select(i => ToLine(i.Description, i.Quantity, i.UnitPrice, i.TaxCategory, i.UnitCode, i.ExemptionReason, inv.TaxRate)).ToList());

    internal static Task<decimal?> RateToAedPublicAsync(FinanceDbContext db, string currency, string date, CancellationToken ct) =>
        RateToAedAsync(db, currency, date, ct);

    private static EInvoiceLine ToLine(string desc, decimal qty, decimal price, string? cat, string? unit, string? reason, decimal rate)
    {
        var c = string.IsNullOrWhiteSpace(cat) ? "S" : cat.Trim().ToUpperInvariant();
        return new EInvoiceLine(desc, qty, unit, price, c, c == "S" ? rate : 0m, reason);
    }

    private static async Task<LoadedEInvoice> AssembleAsync(
        FinanceDbContext db, string type, Guid id, bool isCredit, string number, string date, string? dueDate, string currency,
        string? note, string? creditReason, string? originalNumber, string? originalDate,
        Guid? customerId, string customerName, string? customerAddress, string? customerTrn,
        IReadOnlyList<EInvoiceLine> lines, CancellationToken ct)
    {
        var supplier = await LoadSupplierAsync(db, ct);

        Customer? customer = customerId is null ? null
            : await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == customerId && !c.IsDeleted, ct);
        var buyer = BuyerFor(customerName, customerAddress, customerTrn, customer);

        decimal? aedRate = null;
        if (!currency.Equals("AED", StringComparison.OrdinalIgnoreCase))
            aedRate = await RateToAedAsync(db, currency, date, ct);

        var doc = new EInvoiceDocument(isCredit, number, date, dueDate, currency.ToUpperInvariant(), aedRate, note,
            creditReason, originalNumber, originalDate, supplier, buyer, lines);
        return new LoadedEInvoice(doc, type, id, number);
    }

    public static async Task<EInvoiceParty> LoadSupplierAsync(FinanceDbContext db, CancellationToken ct)
    {
        var profile  = await db.UaeVatProfiles.AsNoTracking().FirstOrDefaultAsync(ct);
        var settings = await db.EInvoiceSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var branding = await RecurringInvoiceGenerator.ResolveBrandingAsync(db, ct);

        // The VAT registration is the legal identity; Settings, General is only the letterhead fallback.
        var trn = profile is { Trn.Length: > 0 } ? profile.Trn
            : new string((branding.TaxNumber ?? "").Where(char.IsDigit).ToArray());
        var name = profile is { NameEn.Length: > 0 } ? profile.NameEn : branding.Name;
        var street = profile?.Address ?? branding.Address;

        var legalId = Pick(settings?.LegalId, branding.RegistrationNo);
        var scheme = settings?.LegalIdScheme ?? (legalId is null ? null : "AE:TL");
        return new EInvoiceParty(name, string.IsNullOrEmpty(trn) ? null : trn, scheme, legalId,
            settings?.RegistrationAuthority, street, settings?.SupplierCity, profile?.DefaultEmirate, "AE", null);
    }

    private static string? Pick(string? first, string? second) =>
        !string.IsNullOrWhiteSpace(first) ? first.Trim() : !string.IsNullOrWhiteSpace(second) ? second.Trim() : null;

    /// <summary>Dirhams per one unit of <paramref name="currency"/>, or null when a rate is missing. Never guesses.</summary>
    private static async Task<decimal?> RateToAedAsync(FinanceDbContext db, string currency, string date, CancellationToken ct)
    {
        var baseCode = (await db.Currencies.AsNoTracking().Where(c => c.IsBaseCurrency).Select(c => c.Code).FirstOrDefaultAsync(ct))
            ?.Trim().ToUpperInvariant() ?? "USD";
        var from = await GlPoster.BasePerUnitAsync(db, currency.Trim().ToUpperInvariant(), baseCode, date, ct);
        var aed  = await GlPoster.BasePerUnitAsync(db, "AED", baseCode, date, ct);
        return from is null || aed is null || aed.Value == 0m ? null : from.Value / aed.Value;
    }
}

/// <summary>Creates queue entries. Never sends: the processor does, so an outage never blocks invoicing.</summary>
internal static class EInvoiceQueue
{
    public static async Task<EInvoiceSettings> GetOrCreateSettingsAsync(FinanceDbContext db, CancellationToken ct)
    {
        var s = await db.EInvoiceSettings.FirstOrDefaultAsync(ct);
        if (s is not null) return s;
        s = new EInvoiceSettings("none");
        db.EInvoiceSettings.Add(s);
        await db.SaveChangesAsync(ct);
        return s;
    }

    /// <summary>
    /// Queues one document. A document with a live submission is returned as it is (never queued twice).
    /// Incomplete data produces a <c>blocked</c> submission carrying the reasons, so the problem is visible
    /// on the document instead of silently dropping it.
    /// </summary>
    public static async Task<EInvoiceSubmission> QueueAsync(FinanceDbContext db, string type, Guid id, string providerKey, CancellationToken ct)
    {
        var existing = await db.EInvoiceSubmissions.FirstOrDefaultAsync(s => s.DocumentType == type && s.DocumentId == id, ct);
        if (existing is not null && EInvoiceStatus.Locking.Contains(existing.Status)) return existing;

        var loaded = await EInvoiceDocumentFactory.LoadAsync(db, type, id, ct)
            ?? throw new InvalidOperationException("The document no longer exists.");
        var errors = PintAeValidator.Validate(loaded.Document).Where(i => i.Severity == EInvoiceIssue.Error).ToList();

        var sub = existing ?? new EInvoiceSubmission(type, id, loaded.Number, providerKey);
        if (existing is null) db.EInvoiceSubmissions.Add(sub);

        if (errors.Count > 0) sub.Block("Not sent: " + string.Join(" ", errors.Select(e => e.Message)));
        else sub.Requeue();
        await db.SaveChangesAsync(ct);
        return sub;
    }

    /// <summary>Called when an invoice or credit note is issued. A no-op unless e-invoicing is switched on and has started.</summary>
    public static async Task EnqueueIfEnabledAsync(FinanceDbContext db, string type, Guid id, string documentDate, ILogger logger, CancellationToken ct)
    {
        try
        {
            var s = await db.EInvoiceSettings.AsNoTracking().FirstOrDefaultAsync(ct);
            if (s is null || !s.Enabled || s.ProviderKey == "none") return;
            if (!string.IsNullOrWhiteSpace(s.GoLiveDate) && string.CompareOrdinal(documentDate, s.GoLiveDate) < 0) return;
            await QueueAsync(db, type, id, s.ProviderKey, ct);
        }
        catch (Exception ex)
        {
            // Issuing the document has already been committed. A queueing problem must not undo or fail it.
            logger.LogError(ex, "Could not queue {Type} {Id} for e-invoicing.", type, id);
        }
    }

    /// <summary>True while the document is queued, on its way or out. Such a document must not be edited.</summary>
    public static Task<bool> IsLockedAsync(FinanceDbContext db, string type, Guid id, CancellationToken ct) =>
        db.EInvoiceSubmissions.AsNoTracking().AnyAsync(s => s.DocumentType == type && s.DocumentId == id
            && EInvoiceStatus.Locking.Contains(s.Status), ct);
}

/// <summary>Sends what is due for the current workspace. Claim first, then send, so nothing goes out twice.</summary>
internal sealed class EInvoiceProcessor(FinanceDbContext db, IEInvoiceGateway gateway, ILogger<EInvoiceProcessor> logger)
{
    public async Task<int> RunAsync(CancellationToken ct)
    {
        if (!gateway.IsAvailable) return 0;
        var settings = await db.EInvoiceSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (settings is null || !settings.Enabled || settings.ProviderKey != gateway.ProviderKey) return 0;

        var now = DateTime.UtcNow;
        var due = await db.EInvoiceSubmissions
            .Where(s => s.Status == EInvoiceStatus.Queued && s.NextAttemptAt <= now)
            .OrderBy(s => s.CreatedAt).Take(25).Select(s => s.Id).ToListAsync(ct);

        var handled = 0;
        foreach (var id in due)
        {
            // The claim: only the caller whose UPDATE changes the row may send it.
            var claimed = await db.EInvoiceSubmissions
                .Where(s => s.Id == id && s.Status == EInvoiceStatus.Queued)
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.Status, EInvoiceStatus.Sending), ct);
            if (claimed == 0) continue;

            var sub = await db.EInvoiceSubmissions.FirstAsync(s => s.Id == id, ct);
            try
            {
                var loaded = await EInvoiceDocumentFactory.LoadAsync(db, sub.DocumentType, sub.DocumentId, ct);
                if (loaded is null) { sub.Rejected("The document no longer exists."); await db.SaveChangesAsync(ct); continue; }

                var errors = PintAeValidator.Validate(loaded.Document).Where(i => i.Severity == EInvoiceIssue.Error).ToList();
                if (errors.Count > 0)
                {
                    sub.Block("Not sent: " + string.Join(" ", errors.Select(e => e.Message)));
                    await db.SaveChangesAsync(ct);
                    continue;
                }

                // The snapshot: the first attempt's document is kept and is what every retry sends.
                var xml = sub.XmlSnapshot ?? PintAeBuilder.Build(loaded.Document);
                sub.BeginAttempt(xml, PintAeBuilder.Hash(xml));
                await db.SaveChangesAsync(ct);

                var result = await gateway.SendAsync(new EInvoiceSendRequest(sub.DocumentType, sub.DocumentId, sub.DocumentNumber,
                    settings.Environment, $"{sub.DocumentType}:{sub.DocumentId}", xml, loaded.Document), ct);

                switch (result.Outcome)
                {
                    case EInvoiceSendOutcome.Sent or EInvoiceSendOutcome.Delivered or EInvoiceSendOutcome.Accepted:
                        sub.Succeeded(result.Outcome, result.ExternalId); break;
                    case EInvoiceSendOutcome.Rejected:
                        sub.Rejected(result.Message); break;
                    case EInvoiceSendOutcome.NotAvailable:
                        // Nothing left Vrodux. Put it back without counting a failed attempt.
                        sub.Requeue(); break;
                    default:
                        sub.Failed(result.Message); break;
                }
                await db.SaveChangesAsync(ct);
                handled++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "E-invoice {Id} failed while sending.", id);
                sub.Failed("Unexpected error while sending. It will be retried.");
                await db.SaveChangesAsync(CancellationToken.None);
            }
        }
        return handled;
    }
}

/// <summary>Every few minutes, sends what is due in each workspace that has something queued.</summary>
public sealed class EInvoiceHostedService(
    IServiceScopeFactory scopeFactory, ITenantWorkFilter workFilter, ILogger<EInvoiceHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);
    // Not on the boot path: startup awaits every migration before serving, and /health must not wait on this.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAllAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { logger.LogError(ex, "E-invoicing: send pass failed."); }
            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task RunAllAsync(CancellationToken ct)
    {
        List<Guid> tenants;
        using (var scope = scopeFactory.CreateScope())
        {
            // The provider decides whether there is any point looking; with none connected this is free.
            if (!scope.ServiceProvider.GetRequiredService<IEInvoiceGateway>().IsAvailable) return;
            var db = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
            var now = DateTime.UtcNow;
            tenants = await db.EInvoiceSubmissions.IgnoreQueryFilters()
                .Where(s => s.Status == EInvoiceStatus.Queued && s.NextAttemptAt <= now)
                .Select(s => EF.Property<Guid?>(s, "TenantId")).Where(t => t != null).Distinct()
                .Select(t => t!.Value).ToListAsync(ct);
        }

        foreach (var tenantId in tenants)
        {
            if (ct.IsCancellationRequested) return;
            if (!await workFilter.ShouldProcessAsync(tenantId, ct)) continue;
            using var scope = scopeFactory.CreateScope();
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                await scope.ServiceProvider.GetRequiredService<EInvoiceProcessor>().RunAsync(ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { logger.LogError(ex, "E-invoicing: workspace {Tenant} failed.", tenantId); }
            finally { TenantAmbient.Clear(); }
        }
    }
}
