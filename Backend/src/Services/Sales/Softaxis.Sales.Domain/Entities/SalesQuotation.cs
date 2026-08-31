using System.Security.Cryptography;
using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.Sales.Domain.Entities;

/// <summary>
/// A customer-facing quotation / proposal.
///
/// This started life as a thin "items + total" record that only ever produced a sales order.
/// It is now the tenant's actual proposal *document*: a cover note, grouped sections, optional
/// (upsell) lines that are quoted but excluded from the total, payment terms, terms and
/// conditions, arbitrary custom fields, a tokenised public link the customer can open and
/// respond to without an account, and a link to whichever invoice it ends up billed under.
///
/// The status vocabulary is deliberately unchanged (draft | sent | approved | rejected |
/// converted | expired) with only "viewed" added — the existing convert-to-order guard and every
/// stored row keep working, and "approved"/"rejected" already meant accepted/declined.
/// </summary>
public sealed class SalesQuotation
{
    public const string StatusDraft     = "draft";
    public const string StatusSent      = "sent";
    public const string StatusViewed    = "viewed";
    public const string StatusApproved  = "approved";
    public const string StatusRejected  = "rejected";
    public const string StatusConverted = "converted";
    public const string StatusExpired   = "expired";

    /// <summary>Statuses a customer may still act on from the public link.</summary>
    public static readonly string[] RespondableStatuses = [StatusSent, StatusViewed];

    private SalesQuotation() { }

    public SalesQuotation(
        Guid?   customerId,
        string? customerName,
        string? notes,
        string? validUntil,
        decimal discountPercent)
    {
        Id              = Guid.NewGuid();
        QuotationNumber = $"QT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        CustomerId      = customerId;
        CustomerName    = customerName?.Trim();
        Status          = StatusDraft;
        Notes           = Trim(notes);
        ValidUntil      = validUntil;
        DiscountPercent = Math.Clamp(discountPercent, 0, 100);
        CurrencyCode    = TenantCurrency.Resolve();
        IssueDate       = DateTime.UtcNow.ToString("yyyy-MM-dd");
        CreatedAt       = DateTime.UtcNow;
    }

    // ── Identity ──────────────────────────────────────────────────────────────
    public Guid   Id              { get; private set; }
    public string QuotationNumber { get; private set; } = string.Empty;
    public string Status          { get; private set; } = StatusDraft;
    public string CurrencyCode    { get; private set; } = TenantCurrency.Fallback;

    // ── Customer ──────────────────────────────────────────────────────────────
    public Guid?   CustomerId      { get; private set; }
    public string? CustomerName    { get; private set; }
    public string? CustomerEmail   { get; private set; }
    public string? CustomerPhone   { get; private set; }
    public string? CustomerAddress { get; private set; }

    // ── Document ──────────────────────────────────────────────────────────────
    public string? Title              { get; private set; }
    public string? Reference          { get; private set; }
    public string? IssueDate          { get; private set; }
    public string? ValidUntil         { get; private set; }
    public string? CoverNote          { get; private set; }
    public string? TermsAndConditions { get; private set; }
    public string? PaymentTerms       { get; private set; }
    public string? Notes              { get; private set; }
    public string? PreparedByName     { get; private set; }
    public decimal DiscountPercent    { get; private set; }

    /// <summary>
    /// Free-form extra rows the tenant wants on the document (project code, delivery lead time,
    /// warranty…). Stored as JSON so a tenant can add a field without a migration — this is what
    /// makes the document "fully dynamic" without shipping a schema editor.
    /// </summary>
    public Dictionary<string, string>? CustomFields { get; private set; }

    // ── Sharing / customer response ───────────────────────────────────────────
    public string?   ShareToken      { get; private set; }
    public DateTime? SentAt          { get; private set; }
    public string?   SentTo          { get; private set; }
    public DateTime? ViewedAt        { get; private set; }
    public DateTime? RespondedAt     { get; private set; }
    public string?   RespondedByName { get; private set; }
    public string?   ResponseComment { get; private set; }

    // ── Downstream links ──────────────────────────────────────────────────────
    public Guid?   ConvertedOrderId { get; private set; }
    public Guid?   InvoiceId        { get; private set; }
    public string? InvoiceNumber    { get; private set; }

    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public Customer?                          Customer { get; private set; }
    public ICollection<SalesQuotationSection> Sections { get; private set; } = new List<SalesQuotationSection>();
    public ICollection<SalesQuotationItem>    Items    { get; private set; } = new List<SalesQuotationItem>();

    // ── Totals ────────────────────────────────────────────────────────────────
    // Optional lines are quoted for the customer to consider but never counted: including them
    // would overstate every proposal that offers an upsell.
    private IEnumerable<SalesQuotationItem> Billable => Items.Where(i => !i.IsOptional);

    /// <summary>Sum of the billable lines, after each line's own discount.</summary>
    public decimal SubTotal => Billable.Sum(i => i.LineTotal);

    /// <summary>
    /// The header discount, applied to the line subtotal. It was previously stored and rendered
    /// but never actually subtracted, so a quotation showing "10% discount" still charged full
    /// price.
    /// </summary>
    public decimal DiscountAmount => Math.Round(SubTotal * DiscountPercent / 100m, 2);

    public decimal NetSubTotal => SubTotal - DiscountAmount;

    /// <summary>
    /// Tax per line, on that line's share of the post-header-discount amount — so a header
    /// discount reduces the tax owed rather than being taxed as if it were never given.
    /// </summary>
    public decimal TaxAmount
    {
        get
        {
            var gross = SubTotal;
            if (gross <= 0) return 0m;
            var factor = NetSubTotal / gross;
            return Math.Round(Billable.Sum(i => i.LineTotal * factor * i.TaxRate / 100m), 2);
        }
    }

    public decimal Total => NetSubTotal + TaxAmount;

    /// <summary>What the optional extras would add, so the document can show "+ X if selected".</summary>
    public decimal OptionalTotal =>
        Items.Where(i => i.IsOptional).Sum(i => i.LineTotal + i.LineTotal * i.TaxRate / 100m);

    // ── Behaviour ─────────────────────────────────────────────────────────────
    public void Update(Guid? customerId, string? customerName, string? notes,
        string? validUntil, decimal discountPercent, string status)
    {
        CustomerId      = customerId;
        CustomerName    = customerName?.Trim();
        Notes           = Trim(notes);
        ValidUntil      = validUntil;
        DiscountPercent = Math.Clamp(discountPercent, 0, 100);
        Status          = status;
        UpdatedAt       = DateTime.UtcNow;
    }

    public void SetDocument(
        string? title, string? reference, string? issueDate, string? coverNote,
        string? termsAndConditions, string? paymentTerms, string? preparedByName,
        Dictionary<string, string>? customFields)
    {
        Title     = Trim(title);
        Reference = Trim(reference);
        if (!string.IsNullOrWhiteSpace(issueDate)) IssueDate = issueDate;
        CoverNote          = Trim(coverNote);
        TermsAndConditions = Trim(termsAndConditions);
        PaymentTerms       = Trim(paymentTerms);
        PreparedByName     = Trim(preparedByName);
        CustomFields       = customFields is { Count: > 0 }
            ? customFields.Where(kv => !string.IsNullOrWhiteSpace(kv.Key))
                          .ToDictionary(kv => kv.Key.Trim(), kv => kv.Value?.Trim() ?? string.Empty)
            : null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetCustomerContact(string? email, string? phone, string? address)
    {
        CustomerEmail   = Trim(email)?.ToLowerInvariant();
        CustomerPhone   = Trim(phone);
        CustomerAddress = Trim(address);
        UpdatedAt       = DateTime.UtcNow;
    }

    /// <summary>
    /// Issues (or reuses) the unguessable token behind the public link and marks the quotation
    /// sent. The token is stable across re-sends so a link already in the customer's inbox keeps
    /// working — reissuing it on every send would silently break the previous email.
    /// </summary>
    public string MarkSent(string? sentTo)
    {
        ShareToken ??= NewShareToken();
        SentTo      = Trim(sentTo)?.ToLowerInvariant() ?? SentTo;
        SentAt      = DateTime.UtcNow;
        // A quotation the customer has already answered must not be dragged back to "sent".
        if (Status is StatusDraft or StatusSent or StatusViewed or StatusExpired) Status = StatusSent;
        UpdatedAt = DateTime.UtcNow;
        return ShareToken;
    }

    /// <summary>Ensures a share link exists without sending anything (copy-link flow).</summary>
    public string EnsureShareToken()
    {
        ShareToken ??= NewShareToken();
        UpdatedAt = DateTime.UtcNow;
        return ShareToken;
    }

    public void RevokeShareLink()
    {
        ShareToken = null;
        UpdatedAt  = DateTime.UtcNow;
    }

    /// <summary>First open of the public link. Never downgrades a quotation already responded to.</summary>
    public void MarkViewed()
    {
        ViewedAt ??= DateTime.UtcNow;
        if (Status == StatusSent) { Status = StatusViewed; UpdatedAt = DateTime.UtcNow; }
    }

    public bool Respond(bool accepted, string? byName, string? comment)
    {
        if (!RespondableStatuses.Contains(Status)) return false;
        Status          = accepted ? StatusApproved : StatusRejected;
        RespondedAt     = DateTime.UtcNow;
        RespondedByName = Trim(byName);
        ResponseComment = Trim(comment);
        UpdatedAt       = DateTime.UtcNow;
        return true;
    }

    /// <summary>True once the validity date has passed — computed, so it is never stale.</summary>
    public bool IsExpired(DateTime asOfUtc) =>
        Status is StatusSent or StatusViewed
        && DateOnly.TryParse(ValidUntil, out var until)
        && DateOnly.FromDateTime(asOfUtc) > until;

    public void MarkConverted(Guid orderId)
    {
        Status           = StatusConverted;
        ConvertedOrderId = orderId;
        UpdatedAt        = DateTime.UtcNow;
    }

    /// <summary>
    /// Links the quotation to the Finance invoice it is billed under — whether that invoice was
    /// generated from this quotation or an existing one it was attached to. Deliberately does NOT
    /// force the status to "converted": attaching a quotation to an invoice for reference is not
    /// the same act as turning it into a sales order.
    /// </summary>
    public void LinkInvoice(Guid? invoiceId, string? invoiceNumber)
    {
        InvoiceId     = invoiceId;
        InvoiceNumber = Trim(invoiceNumber);
        UpdatedAt     = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    // URL-safe, 32 chars of base64url over 24 random bytes — the only thing standing between an
    // anonymous request and this document, so it comes from a CSPRNG, not a Guid.
    private static string NewShareToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(24))
               .Replace("+", "-").Replace("/", "_").TrimEnd('=');

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

/// <summary>
/// A named group of lines on a quotation ("Phase 1 — Discovery", "Hardware", "Optional add-ons").
/// Items reference a section by id; an item with no section renders in an implicit first block,
/// so a simple flat quotation needs no sections at all.
/// </summary>
public sealed class SalesQuotationSection
{
    private SalesQuotationSection() { }

    public SalesQuotationSection(Guid quotationId, string title, string? description, int sortOrder)
    {
        Id          = Guid.NewGuid();
        QuotationId = quotationId;
        Title       = title.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        SortOrder   = sortOrder;
    }

    public Guid    Id          { get; private set; }
    public Guid    QuotationId { get; private set; }
    public string  Title       { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int     SortOrder   { get; private set; }

    public SalesQuotation? Quotation { get; private set; }
}

public sealed class SalesQuotationItem
{
    private SalesQuotationItem() { }

    public SalesQuotationItem(Guid quotationId, Guid? productId, string description,
        decimal quantity, decimal unitPrice, decimal discountPercent, decimal taxRate,
        Guid? sectionId = null, string? unit = null, string? notes = null,
        bool isOptional = false, int sortOrder = 0)
    {
        Id              = Guid.NewGuid();
        QuotationId     = quotationId;
        ProductId       = productId;
        Description     = description.Trim();
        Quantity        = quantity;
        UnitPrice       = unitPrice;
        DiscountPercent = Math.Clamp(discountPercent, 0, 100);
        TaxRate         = taxRate;
        SectionId       = sectionId;
        Unit            = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();
        Notes           = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsOptional      = isOptional;
        SortOrder       = sortOrder;
    }

    public Guid    Id              { get; private set; }
    public Guid    QuotationId     { get; private set; }
    public Guid?   SectionId       { get; private set; }
    public Guid?   ProductId       { get; private set; }
    public string  Description     { get; private set; } = string.Empty;
    public string? Unit            { get; private set; }
    public string? Notes           { get; private set; }
    public decimal Quantity        { get; private set; }
    public decimal UnitPrice       { get; private set; }
    public decimal DiscountPercent { get; private set; }
    public decimal TaxRate         { get; private set; }

    /// <summary>Quoted but not counted in the total — an add-on the customer can choose.</summary>
    public bool IsOptional { get; private set; }
    public int  SortOrder  { get; private set; }

    public decimal LineTotal => Quantity * UnitPrice * (1 - DiscountPercent / 100);

    public SalesQuotation? Quotation { get; private set; }
}
