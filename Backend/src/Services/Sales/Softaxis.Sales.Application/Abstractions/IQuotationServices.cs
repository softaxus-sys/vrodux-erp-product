using Softaxis.Sales.Application.Quotations.Dtos;

namespace Softaxis.Sales.Application.Abstractions;

/// <summary>
/// Reads the issuing company's letterhead for the current tenant, so a quotation the customer
/// opens carries the tenant's own name, address and tax number rather than a placeholder.
/// </summary>
public interface IQuotationBrandingProvider
{
    Task<QuotationBrandingDto> GetAsync(Guid? tenantId, CancellationToken ct = default);
}

/// <summary>
/// Emails a quotation to a customer. Returns false when SMTP is not configured or the send
/// failed, so the caller can surface the share link instead of silently reporting success —
/// the same honest-failure contract the employee-invite email uses.
/// </summary>
public interface IQuotationEmailSender
{
    /// <param name="brand">The company letterhead — name, logo, address, tax number — shown in the email.</param>
    /// <param name="showLogo">False when the quotation's template turned the logo off.</param>
    /// <param name="accentColor">The quotation's own accent (from its template); falls back to the company's.</param>
    Task<bool> SendAsync(
        string  toEmail,
        string? toName,
        string  quotationNumber,
        string? title,
        QuotationBrandingDto brand,
        bool    showLogo,
        string? accentColor,
        string  publicUrl,
        string? message,
        string? validUntil,
        string  formattedTotal,
        string? footerNote,
        CancellationToken ct = default);
}

/// <summary>
/// Where the customer-facing quotation page lives, e.g. https://app.vrodux.com/q/{token}.
/// Configured once per deployment; the handler must never guess it from the inbound request,
/// which for an API call is the gateway's host, not the app's.
/// </summary>
public interface IPublicLinkBuilder
{
    string QuotationUrl(string token);
}
