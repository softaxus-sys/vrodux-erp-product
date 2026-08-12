using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// One charge against a <see cref="Subscription"/>. Mirrored from the provider so the in-app
/// billing history keeps working even if the provider is unreachable, and so finance has a local
/// record of every amount taken.
/// </summary>
public sealed class SubscriptionInvoice : AuditableEntity<Guid>
{
    private SubscriptionInvoice() { }   // EF

    public SubscriptionInvoice(
        Guid            subscriptionId,
        Guid            tenantId,
        PaymentProvider provider,
        string          providerInvoiceId,
        decimal         amount,
        string          currency,
        InvoiceStatus   status) : base(Guid.NewGuid())
    {
        SubscriptionId    = subscriptionId;
        TenantId          = tenantId;
        Provider          = provider;
        ProviderInvoiceId = providerInvoiceId;
        Amount            = amount;
        Currency          = currency;
        Status            = status;
        CreatedAt         = DateTime.UtcNow;
    }

    public Guid            SubscriptionId    { get; private set; }
    public Guid            TenantId          { get; private set; }
    public PaymentProvider Provider          { get; private set; }

    /// <summary>Provider invoice id — unique per provider, so a retried webhook can't duplicate a row.</summary>
    public string          ProviderInvoiceId { get; private set; } = string.Empty;

    public decimal         Amount            { get; private set; }
    public string          Currency          { get; private set; } = "USD";
    public InvoiceStatus   Status            { get; private set; }

    public DateTime?       PeriodStart       { get; private set; }
    public DateTime?       PeriodEnd         { get; private set; }
    public DateTime?       PaidAt            { get; private set; }

    /// <summary>Provider-hosted invoice page / PDF, surfaced as a download link in billing history.</summary>
    public string?         HostedInvoiceUrl  { get; private set; }
    public string?         InvoicePdfUrl     { get; private set; }

    public void SetPeriod(DateTime? start, DateTime? end)
    {
        PeriodStart = start;
        PeriodEnd   = end;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void SetLinks(string? hostedUrl, string? pdfUrl)
    {
        HostedInvoiceUrl = hostedUrl;
        InvoicePdfUrl    = pdfUrl;
        UpdatedAt        = DateTime.UtcNow;
    }

    public void MarkPaid(DateTime paidAt)
    {
        Status    = InvoiceStatus.Paid;
        PaidAt    = paidAt;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkStatus(InvoiceStatus status)
    {
        Status    = status;
        UpdatedAt = DateTime.UtcNow;
    }
}
