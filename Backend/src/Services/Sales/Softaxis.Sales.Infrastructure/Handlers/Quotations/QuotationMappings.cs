using Softaxis.Sales.Application.Quotations.Dtos;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Handlers.Quotations;

internal static class QuotationMappings
{
    public static QuotationSectionDto ToDto(SalesQuotationSection s) =>
        new(s.Id, s.Title, s.Description, s.SortOrder);

    public static QuotationItemDto ToDto(SalesQuotationItem i) =>
        new(i.Id, i.SectionId, i.ProductId, i.Description, i.Unit, i.Notes,
            i.Quantity, i.UnitPrice, i.DiscountPercent, i.TaxRate,
            i.IsOptional, i.SortOrder, i.LineTotal);

    public static QuotationDto ToDto(SalesQuotation q)
    {
        var now = DateTime.UtcNow;
        return new QuotationDto(
            q.Id, q.QuotationNumber, q.Title, q.Reference,
            q.CustomerId, q.CustomerName, q.CustomerEmail, q.CustomerPhone, q.CustomerAddress,
            q.Status, q.CurrencyCode, q.IssueDate, q.ValidUntil, q.IsExpired(now),
            q.CoverNote, q.TermsAndConditions, q.PaymentTerms, q.Notes, q.PreparedByName,
            q.CustomFields,
            q.DiscountPercent, q.SubTotal, q.DiscountAmount, q.NetSubTotal, q.TaxAmount, q.Total, q.OptionalTotal,
            q.Sections.OrderBy(s => s.SortOrder).Select(ToDto).ToList(),
            OrderedItems(q).Select(ToDto).ToList(),
            q.ShareToken, q.SentAt, q.SentTo, q.ViewedAt,
            q.RespondedAt, q.RespondedByName, q.ResponseComment,
            q.ConvertedOrderId, q.InvoiceId, q.InvoiceNumber,
            q.CreatedAt, q.UpdatedAt);
    }

    /// <summary>
    /// Strips everything a customer holding the link has no business seeing: internal notes,
    /// the token itself, and the downstream order/invoice ids.
    /// </summary>
    public static PublicQuotationDto ToPublicDto(SalesQuotation q, QuotationBrandingDto branding)
    {
        var now = DateTime.UtcNow;
        var expired = q.IsExpired(now);
        return new PublicQuotationDto(
            q.QuotationNumber, q.Title, q.Reference, q.CustomerName,
            q.Status, q.CurrencyCode, q.IssueDate, q.ValidUntil, expired,
            CanRespond: !expired && SalesQuotation.RespondableStatuses.Contains(q.Status),
            q.CoverNote, q.TermsAndConditions, q.PaymentTerms, q.PreparedByName,
            q.CustomFields,
            q.DiscountPercent, q.SubTotal, q.DiscountAmount, q.TaxAmount, q.Total, q.OptionalTotal,
            q.Sections.OrderBy(s => s.SortOrder).Select(ToDto).ToList(),
            OrderedItems(q).Select(ToDto).ToList(),
            q.RespondedAt, q.ResponseComment,
            branding);
    }

    /// <summary>
    /// Lines in document order: by their section's position, then their own. Sorting by
    /// SortOrder alone would interleave sections, since each section numbers its lines from 0.
    /// </summary>
    private static IEnumerable<SalesQuotationItem> OrderedItems(SalesQuotation q)
    {
        var sectionOrder = q.Sections.ToDictionary(s => s.Id, s => s.SortOrder);
        return q.Items
            .OrderBy(i => i.SectionId.HasValue && sectionOrder.TryGetValue(i.SectionId.Value, out var o) ? o : -1)
            .ThenBy(i => i.SortOrder);
    }

    public static QuotationTemplateItemDto ToDto(QuotationTemplateItem i) =>
        new(i.Id, i.Description, i.Unit, i.Quantity, i.UnitPrice, i.DiscountPercent,
            i.TaxRate, i.SectionTitle, i.IsOptional, i.SortOrder);

    public static QuotationTemplateDto ToDto(QuotationTemplate t) =>
        new(t.Id, t.Name, t.Description, t.TitleTemplate, t.CoverNote, t.TermsAndConditions,
            t.PaymentTerms, t.FooterNote, t.ValidityDays, t.DefaultTaxRate, t.DefaultDiscount,
            t.AccentColor, t.ShowLogo, t.CustomFields, t.IsDefault, t.IsActive,
            t.Items.OrderBy(i => i.SortOrder).Select(ToDto).ToList(),
            t.CreatedAt, t.UpdatedAt);
}
