namespace Softaxis.Sales.Application.Quotations.Dtos;

public sealed record QuotationSectionDto(
    Guid    Id,
    string  Title,
    string? Description,
    int     SortOrder);

public sealed record QuotationItemDto(
    Guid    Id,
    Guid?   SectionId,
    Guid?   ProductId,
    string  Description,
    string? Unit,
    string? Notes,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate,
    bool    IsOptional,
    int     SortOrder,
    decimal LineTotal);

/// <summary>List row. Deliberately lean — the document body only loads on open.</summary>
public sealed record QuotationSummaryDto(
    Guid      Id,
    string    QuotationNumber,
    string?   Title,
    Guid?     CustomerId,
    string?   CustomerName,
    string    Status,
    string    CurrencyCode,
    decimal   DiscountPercent,
    decimal   SubTotal,
    decimal   DiscountAmount,
    decimal   TaxAmount,
    decimal   Total,
    int       ItemCount,
    string?   IssueDate,
    string?   ValidUntil,
    bool      IsExpired,
    Guid?     ConvertedOrderId,
    Guid?     InvoiceId,
    string?   InvoiceNumber,
    bool      HasShareLink,
    DateTime? SentAt,
    DateTime? ViewedAt,
    DateTime? RespondedAt,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

/// <summary>The full document, as the builder and the PDF need it.</summary>
public sealed record QuotationDto(
    Guid      Id,
    string    QuotationNumber,
    string?   Title,
    string?   Reference,
    Guid?     CustomerId,
    string?   CustomerName,
    string?   CustomerEmail,
    string?   CustomerPhone,
    string?   CustomerAddress,
    string    Status,
    string    CurrencyCode,
    string?   IssueDate,
    string?   ValidUntil,
    bool      IsExpired,
    string?   CoverNote,
    string?   TermsAndConditions,
    string?   PaymentTerms,
    string?   Notes,
    string?   PreparedByName,
    IReadOnlyDictionary<string, string>? CustomFields,
    decimal   DiscountPercent,
    decimal   SubTotal,
    decimal   DiscountAmount,
    decimal   NetSubTotal,
    decimal   TaxAmount,
    decimal   Total,
    decimal   OptionalTotal,
    IReadOnlyList<QuotationSectionDto> Sections,
    IReadOnlyList<QuotationItemDto>    Items,
    string?   ShareToken,
    DateTime? SentAt,
    string?   SentTo,
    DateTime? ViewedAt,
    DateTime? RespondedAt,
    string?   RespondedByName,
    string?   ResponseComment,
    Guid?     ConvertedOrderId,
    Guid?     InvoiceId,
    string?   InvoiceNumber,
    DateTime  CreatedAt,
    DateTime? UpdatedAt);

/// <summary>
/// What the anonymous public link returns. A strict subset of <see cref="QuotationDto"/>:
/// no internal notes, no share token, no downstream order/invoice ids — a customer holding
/// the link must not learn what the tenant recorded about them internally.
/// </summary>
public sealed record PublicQuotationDto(
    string    QuotationNumber,
    string?   Title,
    string?   Reference,
    string?   CustomerName,
    string    Status,
    string    CurrencyCode,
    string?   IssueDate,
    string?   ValidUntil,
    bool      IsExpired,
    bool      CanRespond,
    string?   CoverNote,
    string?   TermsAndConditions,
    string?   PaymentTerms,
    string?   PreparedByName,
    IReadOnlyDictionary<string, string>? CustomFields,
    decimal   DiscountPercent,
    decimal   SubTotal,
    decimal   DiscountAmount,
    decimal   TaxAmount,
    decimal   Total,
    decimal   OptionalTotal,
    IReadOnlyList<QuotationSectionDto> Sections,
    IReadOnlyList<QuotationItemDto>    Items,
    DateTime? RespondedAt,
    string?   ResponseComment,
    QuotationBrandingDto Branding);

/// <summary>
/// The issuing company as it should appear on the document, read from the tenant's own
/// General Settings so the public page and the PDF carry real letterhead rather than a
/// placeholder.
/// </summary>
public sealed record QuotationBrandingDto(
    string  CompanyName,
    string? LegalName,
    string? Address,
    string? Phone,
    string? Email,
    string? Website,
    string? TaxNumber,
    string? LogoUrl,
    string? AccentColor);

public sealed record QuotationShareLinkDto(string Token, string Url);

public sealed record QuotationSendResultDto(bool EmailSent, string? SentTo, string Url, string? Warning);

public sealed record ConvertQuotationResultDto(Guid OrderId, string OrderNumber);

// ── Templates ─────────────────────────────────────────────────────────────────
public sealed record QuotationTemplateItemDto(
    Guid    Id,
    string  Description,
    string? Unit,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate,
    string? SectionTitle,
    bool    IsOptional,
    int     SortOrder);

public sealed record QuotationTemplateDto(
    Guid    Id,
    string  Name,
    string? Description,
    string? TitleTemplate,
    string? CoverNote,
    string? TermsAndConditions,
    string? PaymentTerms,
    string? FooterNote,
    int     ValidityDays,
    decimal DefaultTaxRate,
    decimal DefaultDiscount,
    string? AccentColor,
    bool    ShowLogo,
    IReadOnlyDictionary<string, string>? CustomFields,
    bool    IsDefault,
    bool    IsActive,
    IReadOnlyList<QuotationTemplateItemDto> Items,
    DateTime CreatedAt,
    DateTime? UpdatedAt);
