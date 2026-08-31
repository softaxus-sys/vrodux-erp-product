namespace Softaxis.Sales.Domain.Entities;

/// <summary>
/// A tenant-defined starting point for a quotation: the boilerplate a business repeats on every
/// proposal (cover note, terms, payment terms, validity, default tax) plus optional prefilled
/// lines.
///
/// This is what makes the document "dynamic" in the way that actually helps: rather than a
/// layout editor, the tenant curates the *content* they reuse, so a new quotation opens already
/// worded like their business instead of blank. Applying a template only seeds a draft — the
/// quotation keeps its own copy of every value, so editing a template never rewrites proposals
/// already sent.
/// </summary>
public sealed class QuotationTemplate
{
    private QuotationTemplate() { }

    public QuotationTemplate(string name, string? description)
    {
        Id          = Guid.NewGuid();
        Name        = name.Trim();
        Description = Trim(description);
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid    Id          { get; private set; }
    public string  Name        { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    // ── Document boilerplate ──────────────────────────────────────────────────
    public string? TitleTemplate       { get; private set; }
    public string? CoverNote           { get; private set; }
    public string? TermsAndConditions  { get; private set; }
    public string? PaymentTerms        { get; private set; }
    public string? FooterNote          { get; private set; }

    // ── Defaults applied to a new quotation ───────────────────────────────────
    public int     ValidityDays    { get; private set; } = 30;
    public decimal DefaultTaxRate  { get; private set; }
    public decimal DefaultDiscount { get; private set; }

    // ── Presentation ──────────────────────────────────────────────────────────
    /// <summary>Hex accent colour used for headings and the totals band on the PDF.</summary>
    public string? AccentColor { get; private set; }
    public bool    ShowLogo    { get; private set; } = true;

    /// <summary>Extra document fields (label → default value) seeded onto the quotation.</summary>
    public Dictionary<string, string>? CustomFields { get; private set; }

    /// <summary>
    /// Exactly one template per tenant may be the default, enforced by the handler rather than a
    /// filtered unique index: flipping the flag is a two-row change and doing it in one
    /// transaction is clearer than fighting an index over it.
    /// </summary>
    public bool IsDefault { get; private set; }
    public bool IsActive  { get; private set; } = true;

    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool      IsDeleted { get; private set; }

    public ICollection<QuotationTemplateItem> Items { get; private set; } = new List<QuotationTemplateItem>();

    public void Update(
        string name, string? description, string? titleTemplate, string? coverNote,
        string? termsAndConditions, string? paymentTerms, string? footerNote,
        int validityDays, decimal defaultTaxRate, decimal defaultDiscount,
        string? accentColor, bool showLogo, Dictionary<string, string>? customFields)
    {
        Name               = name.Trim();
        Description        = Trim(description);
        TitleTemplate      = Trim(titleTemplate);
        CoverNote          = Trim(coverNote);
        TermsAndConditions = Trim(termsAndConditions);
        PaymentTerms       = Trim(paymentTerms);
        FooterNote         = Trim(footerNote);
        ValidityDays       = validityDays <= 0 ? 30 : Math.Min(validityDays, 3650);
        DefaultTaxRate     = Math.Clamp(defaultTaxRate, 0, 100);
        DefaultDiscount    = Math.Clamp(defaultDiscount, 0, 100);
        AccentColor        = Trim(accentColor);
        ShowLogo           = showLogo;
        CustomFields       = customFields is { Count: > 0 }
            ? customFields.Where(kv => !string.IsNullOrWhiteSpace(kv.Key))
                          .ToDictionary(kv => kv.Key.Trim(), kv => kv.Value?.Trim() ?? string.Empty)
            : null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetDefault(bool isDefault) { IsDefault = isDefault; UpdatedAt = DateTime.UtcNow; }
    public void SetActive(bool isActive)   { IsActive  = isActive;  UpdatedAt = DateTime.UtcNow; }
    public void Delete() { IsDeleted = true; IsDefault = false; UpdatedAt = DateTime.UtcNow; }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}

public sealed class QuotationTemplateItem
{
    private QuotationTemplateItem() { }

    public QuotationTemplateItem(Guid templateId, string description, string? unit,
        decimal quantity, decimal unitPrice, decimal discountPercent, decimal taxRate,
        string? sectionTitle, bool isOptional, int sortOrder)
    {
        Id              = Guid.NewGuid();
        TemplateId      = templateId;
        Description     = description.Trim();
        Unit            = string.IsNullOrWhiteSpace(unit) ? null : unit.Trim();
        Quantity        = quantity;
        UnitPrice       = unitPrice;
        DiscountPercent = Math.Clamp(discountPercent, 0, 100);
        TaxRate         = taxRate;
        SectionTitle    = string.IsNullOrWhiteSpace(sectionTitle) ? null : sectionTitle.Trim();
        IsOptional      = isOptional;
        SortOrder       = sortOrder;
    }

    public Guid    Id              { get; private set; }
    public Guid    TemplateId      { get; private set; }
    public string  Description     { get; private set; } = string.Empty;
    public string? Unit            { get; private set; }
    public decimal Quantity        { get; private set; }
    public decimal UnitPrice       { get; private set; }
    public decimal DiscountPercent { get; private set; }
    public decimal TaxRate         { get; private set; }

    /// <summary>
    /// Section is carried as a title, not an id: a template has no sections of its own, and
    /// grouping by title is what lets one template seed several sections on the new quotation.
    /// </summary>
    public string? SectionTitle { get; private set; }
    public bool    IsOptional   { get; private set; }
    public int     SortOrder    { get; private set; }

    public QuotationTemplate? Template { get; private set; }
}
