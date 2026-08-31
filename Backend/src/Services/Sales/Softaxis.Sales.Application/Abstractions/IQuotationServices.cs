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
    Task<bool> SendAsync(
        string  toEmail,
        string? toName,
        string  quotationNumber,
        string? title,
        string  companyName,
        string  publicUrl,
        string? message,
        string? validUntil,
        string  formattedTotal,
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
