using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

internal sealed class SubscriptionRepository(IdentityDbContext db) : ISubscriptionRepository
{
    public Task<Subscription?> GetByTenantAsync(Guid tenantId, CancellationToken ct = default) =>
        db.Subscriptions.FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);

    public Task<Subscription?> GetByProviderSubscriptionIdAsync(string providerSubscriptionId, CancellationToken ct = default) =>
        db.Subscriptions.FirstOrDefaultAsync(s => s.ProviderSubscriptionId == providerSubscriptionId, ct);

    public Task<Subscription?> GetByProviderCustomerIdAsync(string providerCustomerId, CancellationToken ct = default) =>
        db.Subscriptions.FirstOrDefaultAsync(s => s.ProviderCustomerId == providerCustomerId, ct);

    public Task<List<SubscriptionInvoice>> GetInvoicesAsync(Guid tenantId, CancellationToken ct = default) =>
        db.SubscriptionInvoices
          .Where(i => i.TenantId == tenantId)
          .OrderByDescending(i => i.CreatedAt)
          .ToListAsync(ct);

    public Task<SubscriptionInvoice?> GetInvoiceAsync(PaymentProvider provider, string providerInvoiceId, CancellationToken ct = default) =>
        db.SubscriptionInvoices
          .FirstOrDefaultAsync(i => i.Provider == provider && i.ProviderInvoiceId == providerInvoiceId, ct);

    public void Add(Subscription subscription) => db.Subscriptions.Add(subscription);

    public void AddInvoice(SubscriptionInvoice invoice) => db.SubscriptionInvoices.Add(invoice);

    public Task<bool> WebhookEventExistsAsync(PaymentProvider provider, string providerEventId, CancellationToken ct = default) =>
        db.BillingWebhookEvents.AnyAsync(e => e.Provider == provider && e.ProviderEventId == providerEventId, ct);

    public void AddWebhookEvent(BillingWebhookEvent evt) => db.BillingWebhookEvents.Add(evt);
}
