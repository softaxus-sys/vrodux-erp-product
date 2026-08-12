using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Domain.Repositories;

public interface ISubscriptionRepository
{
    Task<Subscription?> GetByTenantAsync(Guid tenantId, CancellationToken ct = default);

    /// <summary>Look up by the provider's own subscription id — the key webhooks arrive with.</summary>
    Task<Subscription?> GetByProviderSubscriptionIdAsync(string providerSubscriptionId, CancellationToken ct = default);

    /// <summary>
    /// Fallback lookup by provider customer id, for events (invoices especially) that carry the
    /// customer but not the subscription.
    /// </summary>
    Task<Subscription?> GetByProviderCustomerIdAsync(string providerCustomerId, CancellationToken ct = default);

    Task<List<SubscriptionInvoice>> GetInvoicesAsync(Guid tenantId, CancellationToken ct = default);

    Task<SubscriptionInvoice?> GetInvoiceAsync(PaymentProvider provider, string providerInvoiceId, CancellationToken ct = default);

    void Add(Subscription subscription);
    void AddInvoice(SubscriptionInvoice invoice);

    // ── Webhook idempotency ───────────────────────────────────────────────────

    /// <summary>True when this provider event has already been recorded (i.e. it's a retry).</summary>
    Task<bool> WebhookEventExistsAsync(PaymentProvider provider, string providerEventId, CancellationToken ct = default);

    void AddWebhookEvent(BillingWebhookEvent evt);
}
