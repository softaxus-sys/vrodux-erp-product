using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

// NOTE: No `HasQueryFilter(!IsDeleted)` here — TenantIsolation.ApplyTenantId runs last in
// OnModelCreating and replaces any entity-level filter with the tenant filter (EF9 semantics).
// Soft-delete is therefore filtered explicitly in handlers (`.Where(x => !x.IsDeleted)`),
// matching the rest of the CRM service.

internal sealed class IntegrationConfiguration : IEntityTypeConfiguration<Integration>
{
    public void Configure(EntityTypeBuilder<Integration> b)
    {
        b.ToTable("integrations");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.ProviderKey).IsRequired().HasMaxLength(50);
        b.Property(x => x.Name).IsRequired().HasMaxLength(200);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue(IntegrationStatus.Disconnected);
        b.Property(x => x.Health).IsRequired().HasMaxLength(20).HasDefaultValue(IntegrationHealth.Unknown);
        b.Property(x => x.Config);          // nvarchar(max) JSON
        b.Property(x => x.Credentials);     // encrypted
        b.Property(x => x.SigningSecret);   // encrypted
        b.Property(x => x.DedupeConfig);
        b.Property(x => x.RoutingConfig);
        b.Property(x => x.InboundKey).IsRequired().HasMaxLength(64);
        b.Property(x => x.LastError).HasMaxLength(1000);
        b.Property(x => x.IsDeleted).HasDefaultValue(false);

        b.HasIndex(x => x.InboundKey);
        b.HasIndex(x => x.ProviderKey);

        b.HasMany(x => x.FieldMappings).WithOne().HasForeignKey(m => m.IntegrationId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Resources).WithOne().HasForeignKey(r => r.IntegrationId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class FieldMappingConfiguration : IEntityTypeConfiguration<FieldMapping>
{
    public void Configure(EntityTypeBuilder<FieldMapping> b)
    {
        b.ToTable("integration_field_mappings");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.SourceField).IsRequired().HasMaxLength(200);
        b.Property(x => x.TargetField).IsRequired().HasMaxLength(100);
        b.HasIndex(x => x.IntegrationId);
    }
}

internal sealed class IntegrationResourceConfiguration : IEntityTypeConfiguration<IntegrationResource>
{
    public void Configure(EntityTypeBuilder<IntegrationResource> b)
    {
        b.ToTable("integration_resources");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.ResourceType).IsRequired().HasMaxLength(40);
        b.Property(x => x.ExternalId).IsRequired().HasMaxLength(200);
        b.Property(x => x.Name).IsRequired().HasMaxLength(300);
        b.Property(x => x.ParentExternalId).HasMaxLength(200);
        b.Property(x => x.AccessToken);   // encrypted
        b.HasIndex(x => x.IntegrationId);
        b.HasIndex(x => new { x.IntegrationId, x.ResourceType });
    }
}

internal sealed class IntegrationSyncLogConfiguration : IEntityTypeConfiguration<IntegrationSyncLog>
{
    public void Configure(EntityTypeBuilder<IntegrationSyncLog> b)
    {
        b.ToTable("integration_sync_logs");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Trigger).IsRequired().HasMaxLength(20);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.Message).HasMaxLength(1000);
        b.HasIndex(x => new { x.IntegrationId, x.StartedAt });
    }
}

internal sealed class RawLeadInboxConfiguration : IEntityTypeConfiguration<RawLeadInbox>
{
    public void Configure(EntityTypeBuilder<RawLeadInbox> b)
    {
        b.ToTable("integration_raw_leads");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.ProviderKey).IsRequired().HasMaxLength(50);
        b.Property(x => x.ExternalId).HasMaxLength(200);
        b.Property(x => x.Payload).IsRequired();   // nvarchar(max)
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.LastError).HasMaxLength(1000);
        b.HasIndex(x => new { x.IntegrationId, x.ReceivedAt });
        b.HasIndex(x => new { x.Status, x.NextAttemptAt });
        b.HasIndex(x => new { x.IntegrationId, x.ExternalId });
    }
}

internal sealed class LeadSourceConfiguration : IEntityTypeConfiguration<LeadSource>
{
    public void Configure(EntityTypeBuilder<LeadSource> b)
    {
        b.ToTable("lead_sources");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.ProviderKey).IsRequired().HasMaxLength(50);
        b.Property(x => x.ExternalLeadId).HasMaxLength(200);
        b.Property(x => x.Campaign).HasMaxLength(300);
        b.Property(x => x.CampaignId).HasMaxLength(100);
        b.Property(x => x.AdSetId).HasMaxLength(100);
        b.Property(x => x.AdId).HasMaxLength(100);
        b.Property(x => x.PageId).HasMaxLength(100);
        b.Property(x => x.FormId).HasMaxLength(100);
        b.Property(x => x.UtmSource).HasMaxLength(200);
        b.Property(x => x.UtmMedium).HasMaxLength(200);
        b.Property(x => x.UtmCampaign).HasMaxLength(200);
        b.Property(x => x.UtmTerm).HasMaxLength(200);
        b.Property(x => x.UtmContent).HasMaxLength(200);
        b.HasIndex(x => x.LeadId);
        b.HasIndex(x => new { x.ProviderKey, x.ExternalLeadId });
    }
}
