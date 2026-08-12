using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        builder.ToTable("subscriptions");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        // One current subscription per tenant. Filtered so a soft-deleted row doesn't block
        // a tenant re-subscribing after cancelling (same pattern as the tenants.Slug index).
        builder.HasIndex(s => s.TenantId).IsUnique().HasFilter("[IsDeleted] = 0");

        builder.Property(s => s.Plan).HasConversion<string>().HasMaxLength(30).IsRequired();
        builder.Property(s => s.BillingPeriod).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(s => s.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(s => s.Provider).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(s => s.ProviderCustomerId).HasMaxLength(120);
        builder.Property(s => s.ProviderSubscriptionId).HasMaxLength(120);
        // Webhooks arrive keyed by provider subscription id — this is the lookup path.
        builder.HasIndex(s => s.ProviderSubscriptionId);

        builder.Property(s => s.Amount).HasColumnType("decimal(18,2)");
        builder.Property(s => s.Currency).HasMaxLength(3).IsRequired();

        builder.Property(s => s.CreatedBy).HasMaxLength(100).HasDefaultValue("system");
        builder.Property(s => s.UpdatedBy).HasMaxLength(100);
        builder.Property(s => s.DeletedBy).HasMaxLength(100);

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}

public sealed class SubscriptionInvoiceConfiguration : IEntityTypeConfiguration<SubscriptionInvoice>
{
    public void Configure(EntityTypeBuilder<SubscriptionInvoice> builder)
    {
        builder.ToTable("subscription_invoices");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();

        builder.HasIndex(i => i.TenantId);
        builder.HasIndex(i => i.SubscriptionId);

        builder.Property(i => i.Provider).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(i => i.ProviderInvoiceId).HasMaxLength(120).IsRequired();
        // A retried "invoice.paid" must update the existing row, never insert a duplicate charge.
        builder.HasIndex(i => new { i.Provider, i.ProviderInvoiceId }).IsUnique();

        builder.Property(i => i.Amount).HasColumnType("decimal(18,2)");
        builder.Property(i => i.Currency).HasMaxLength(3).IsRequired();

        builder.Property(i => i.HostedInvoiceUrl).HasMaxLength(1000);
        builder.Property(i => i.InvoicePdfUrl).HasMaxLength(1000);

        builder.Property(i => i.CreatedBy).HasMaxLength(100).HasDefaultValue("system");
        builder.Property(i => i.UpdatedBy).HasMaxLength(100);
        builder.Property(i => i.DeletedBy).HasMaxLength(100);

        builder.HasQueryFilter(i => !i.IsDeleted);
    }
}

public sealed class BillingWebhookEventConfiguration : IEntityTypeConfiguration<BillingWebhookEvent>
{
    public void Configure(EntityTypeBuilder<BillingWebhookEvent> builder)
    {
        builder.ToTable("billing_webhook_events");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();

        builder.Property(e => e.Provider).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.ProviderEventId).HasMaxLength(200).IsRequired();
        builder.Property(e => e.EventType).HasMaxLength(120).IsRequired();
        builder.Property(e => e.Payload).HasColumnType("nvarchar(max)");
        builder.Property(e => e.Error).HasMaxLength(2000);

        // THE idempotency guard. Not filtered on IsDeleted: a duplicate must be rejected
        // unconditionally, even if someone soft-deletes the original audit row.
        builder.HasIndex(e => new { e.Provider, e.ProviderEventId }).IsUnique();

        builder.Property(e => e.CreatedBy).HasMaxLength(100).HasDefaultValue("system");
        builder.Property(e => e.UpdatedBy).HasMaxLength(100);
        builder.Property(e => e.DeletedBy).HasMaxLength(100);

        // Deliberately NO query filter — the dedupe lookup must see every row ever recorded.
    }
}
