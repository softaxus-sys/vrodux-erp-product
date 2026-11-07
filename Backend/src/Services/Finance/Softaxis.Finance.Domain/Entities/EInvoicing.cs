using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.Finance.Domain.Entities;

/// <summary>
/// A credit note: the only way to correct an invoice that has been issued. It is its own document
/// (own number, own ledger entry), linked to the invoice it corrects — never a negative invoice,
/// which e-invoicing rules forbid.
/// </summary>
public sealed class CreditNote
{
    private CreditNote() { }

    public CreditNote(Guid invoiceId, string invoiceNumber, string customerName, string? customerEmail,
        string? customerAddress, string? customerTrn, Guid? customerId, string creditDate, decimal taxRate,
        string currencyCode, string reason, string? notes)
    {
        Id              = Guid.NewGuid();
        CreditNoteNumber = $"CN-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        InvoiceId       = invoiceId;
        InvoiceNumber   = invoiceNumber;
        CustomerId      = customerId;
        CustomerName    = customerName.Trim();
        CustomerEmail   = customerEmail?.Trim().ToLowerInvariant();
        CustomerAddress = string.IsNullOrWhiteSpace(customerAddress) ? null : customerAddress.Trim();
        CustomerTrn     = string.IsNullOrWhiteSpace(customerTrn) ? null : customerTrn.Trim();
        CreditDate      = creditDate;
        TaxRate         = taxRate;
        CurrencyCode    = currencyCode;
        Reason          = reason.Trim();
        Notes           = notes?.Trim();
        Status          = "draft";
        CreatedAt       = DateTime.UtcNow;
    }

    public Guid      Id               { get; private set; }
    public string    CreditNoteNumber { get; private set; } = string.Empty;
    public Guid      InvoiceId        { get; private set; }
    public string    InvoiceNumber    { get; private set; } = string.Empty;
    public Guid?     CustomerId       { get; private set; }
    public string    CustomerName     { get; private set; } = string.Empty;
    public string?   CustomerEmail    { get; private set; }
    public string?   CustomerAddress  { get; private set; }
    public string?   CustomerTrn      { get; private set; }
    public string    CreditDate       { get; private set; } = string.Empty;
    public decimal   TaxRate          { get; private set; }
    public string    CurrencyCode     { get; private set; } = TenantCurrency.Resolve();
    /// <summary>Why the invoice is being corrected. Required by PINT AE on every credit note.</summary>
    public string    Reason           { get; private set; } = string.Empty;
    public string?   Notes            { get; private set; }
    /// <summary>draft | issued | cancelled. Only an issued credit note reduces what the customer owes.</summary>
    public string    Status           { get; private set; } = "draft";
    public Guid?     JournalEntryId   { get; private set; }
    public DateTime  CreatedAt        { get; private set; }
    public DateTime? UpdatedAt        { get; private set; }
    public DateTime? IssuedAt         { get; private set; }
    public bool      IsDeleted        { get; private set; }

    public ICollection<CreditNoteItem> Items { get; private set; } = new List<CreditNoteItem>();

    public decimal SubTotal      => Items.Sum(i => i.Quantity * i.UnitPrice);
    public decimal TaxableAmount => Items.Where(i => VatCategory.IsStandard(i.TaxCategory)).Sum(i => i.Quantity * i.UnitPrice);
    public decimal TaxAmount     => Math.Round(TaxableAmount * TaxRate / 100, 2, MidpointRounding.AwayFromZero);
    public decimal Total         => SubTotal + TaxAmount;

    public void Issue(Guid? journalEntryId)
    {
        Status         = "issued";
        JournalEntryId = journalEntryId;
        IssuedAt       = DateTime.UtcNow;
        UpdatedAt      = DateTime.UtcNow;
    }

    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}

public sealed class CreditNoteItem
{
    private CreditNoteItem() { }

    public CreditNoteItem(Guid creditNoteId, string description, decimal quantity, decimal unitPrice,
        string? taxCategory, string? unitCode, string? exemptionReason)
    {
        Id           = Guid.NewGuid();
        CreditNoteId = creditNoteId;
        Description  = description.Trim();
        Quantity     = quantity;
        UnitPrice    = unitPrice;
        TaxCategory  = VatCategory.Normalise(taxCategory);
        UnitCode     = string.IsNullOrWhiteSpace(unitCode) ? null : unitCode.Trim().ToUpperInvariant();
        ExemptionReason = VatCategory.IsStandard(TaxCategory) || string.IsNullOrWhiteSpace(exemptionReason)
            ? null : exemptionReason.Trim();
    }

    public Guid    Id           { get; private set; }
    public Guid    CreditNoteId { get; private set; }
    public string  Description  { get; private set; } = string.Empty;
    public decimal Quantity     { get; private set; }
    public decimal UnitPrice    { get; private set; }
    public string? TaxCategory  { get; private set; }
    public string? UnitCode     { get; private set; }
    public string? ExemptionReason { get; private set; }
    public decimal LineTotal    => Quantity * UnitPrice;

    public CreditNote? CreditNote { get; private set; }
}

/// <summary>
/// Per-workspace e-invoicing configuration. One row, created on first read (never at startup —
/// a startup seed has no tenant). Holds no provider credentials yet: those arrive with the first
/// provider adapter, encrypted like the other integration secrets.
/// </summary>
public sealed class EInvoiceSettings
{
    private EInvoiceSettings() { }

    public EInvoiceSettings(string providerKey)
    {
        Id          = Guid.NewGuid();
        ProviderKey = providerKey;
        Environment = "sandbox";
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid      Id          { get; private set; }
    /// <summary>"none" until a provider is connected. Otherwise the adapter key (e.g. "storecove").</summary>
    public string    ProviderKey { get; private set; } = "none";
    /// <summary>sandbox | production.</summary>
    public string    Environment { get; private set; } = "sandbox";
    /// <summary>Queue invoices for sending when they are issued. Off by default.</summary>
    public bool      Enabled     { get; private set; }
    /// <summary>yyyy-MM-dd. Invoices dated before this are never queued.</summary>
    public string?   GoLiveDate  { get; private set; }
    /// <summary>The supplier's legal registration scheme: AE:TL (trade licence), AE:EID, AE:PAS or AE:CD.</summary>
    public string?   LegalIdScheme { get; private set; }
    public string?   LegalId     { get; private set; }
    /// <summary>Issuing authority, required by PINT AE when the scheme is AE:TL.</summary>
    public string?   RegistrationAuthority { get; private set; }
    /// <summary>The supplier's city. The company address in Settings is free text, and PINT AE wants the city on its own.</summary>
    public string?   SupplierCity { get; private set; }
    public DateTime  CreatedAt   { get; private set; }
    public DateTime? UpdatedAt   { get; private set; }

    public void Update(string providerKey, string environment, bool enabled, string? goLiveDate,
        string? legalIdScheme, string? legalId, string? registrationAuthority, string? supplierCity)
    {
        static string? Clean(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        ProviderKey = string.IsNullOrWhiteSpace(providerKey) ? "none" : providerKey.Trim().ToLowerInvariant();
        Environment = environment.Trim().ToLowerInvariant() == "production" ? "production" : "sandbox";
        Enabled     = enabled;
        GoLiveDate  = Clean(goLiveDate);
        LegalIdScheme = Clean(legalIdScheme)?.ToUpperInvariant();
        LegalId     = Clean(legalId);
        RegistrationAuthority = Clean(registrationAuthority);
        SupplierCity = Clean(supplierCity);
        UpdatedAt   = DateTime.UtcNow;
    }
}

public static class EInvoiceStatus
{
    public const string Queued       = "queued";
    public const string Sending      = "sending";
    public const string Sent         = "sent";
    public const string Delivered    = "delivered";
    public const string Accepted     = "accepted";
    public const string Rejected     = "rejected";
    public const string Failed       = "failed";
    public const string Cancelled    = "cancelled";
    /// <summary>The data is not complete enough to send. Nothing left Vrodux; fix the data and queue it again.</summary>
    public const string Blocked      = "blocked";

    /// <summary>States in which the document must not be edited: it is being sent or already out. A merely queued one can still be corrected.</summary>
    public static readonly IReadOnlyList<string> Locking = [Sending, Sent, Delivered, Accepted];
}

/// <summary>
/// One e-invoice going to the provider. The unique (type, document) key is the duplicate-send
/// guard: a document can have only one live submission, however many times a retry fires.
/// </summary>
public sealed class EInvoiceSubmission
{
    private EInvoiceSubmission() { }

    public EInvoiceSubmission(string documentType, Guid documentId, string documentNumber, string providerKey)
    {
        Id             = Guid.NewGuid();
        DocumentType   = documentType;
        DocumentId     = documentId;
        DocumentNumber = documentNumber;
        ProviderKey    = providerKey;
        Status         = EInvoiceStatus.Queued;
        CreatedAt      = DateTime.UtcNow;
        NextAttemptAt  = DateTime.UtcNow;
    }

    public Guid      Id             { get; private set; }
    /// <summary>invoice | credit_note.</summary>
    public string    DocumentType   { get; private set; } = "invoice";
    public Guid      DocumentId     { get; private set; }
    public string    DocumentNumber { get; private set; } = string.Empty;
    public string    ProviderKey    { get; private set; } = "none";
    public string    Status         { get; private set; } = EInvoiceStatus.Queued;
    public int       Attempts       { get; private set; }
    public DateTime? NextAttemptAt  { get; private set; }
    /// <summary>The provider's own id for this transmission, for support queries.</summary>
    public string?   ExternalId     { get; private set; }
    /// <summary>The provider's own words when it refused or failed. Already redacted.</summary>
    public string?   LastError      { get; private set; }
    /// <summary>The exact document that was handed over. A sent invoice is never regenerated.</summary>
    public string?   XmlSnapshot    { get; private set; }
    public string?   PayloadHash    { get; private set; }
    public DateTime  CreatedAt      { get; private set; }
    public DateTime? SentAt         { get; private set; }
    public DateTime? UpdatedAt      { get; private set; }

    public void BeginAttempt(string xml, string hash)
    {
        Status      = EInvoiceStatus.Sending;
        Attempts++;
        XmlSnapshot ??= xml;
        PayloadHash ??= hash;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void Succeeded(string status, string? externalId)
    {
        Status     = status;
        ExternalId = externalId ?? ExternalId;
        LastError  = null;
        SentAt     = DateTime.UtcNow;
        NextAttemptAt = null;
        UpdatedAt  = DateTime.UtcNow;
    }

    /// <summary>The provider refused the document. Retrying the same document cannot help.</summary>
    public void Rejected(string? message)
    {
        Status        = EInvoiceStatus.Rejected;
        LastError     = Trim(message);
        NextAttemptAt = null;
        UpdatedAt     = DateTime.UtcNow;
    }

    /// <summary>A transient problem. Backs off 1, 5, 30 minutes, 2 hours, then every 6 hours; gives up after 8 tries.</summary>
    public void Failed(string? message)
    {
        LastError = Trim(message);
        if (Attempts >= 8) { Status = EInvoiceStatus.Failed; NextAttemptAt = null; }
        else
        {
            Status = EInvoiceStatus.Queued;
            NextAttemptAt = DateTime.UtcNow.AddMinutes(Attempts switch { 1 => 1, 2 => 5, 3 => 30, 4 => 120, _ => 360 });
        }
        UpdatedAt = DateTime.UtcNow;
    }

    public void Block(string message)
    {
        Status = EInvoiceStatus.Blocked;
        LastError = Trim(message);
        NextAttemptAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Puts a failed or rejected submission back in the queue after the cause has been fixed.</summary>
    public void Requeue()
    {
        Status = EInvoiceStatus.Queued;
        NextAttemptAt = DateTime.UtcNow;
        LastError = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status, string? message)
    {
        Status = status;
        if (message is not null) LastError = Trim(message);
        UpdatedAt = DateTime.UtcNow;
    }

    private static string? Trim(string? m) => m is null ? null : m.Length <= 1500 ? m : m[..1500];
}
