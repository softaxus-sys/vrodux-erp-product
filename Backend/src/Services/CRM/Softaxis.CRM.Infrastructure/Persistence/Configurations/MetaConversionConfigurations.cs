using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Persistence.Configurations;

internal sealed class MetaConversionSettingsConfiguration : IEntityTypeConfiguration<MetaConversionSettings>
{
    public void Configure(EntityTypeBuilder<MetaConversionSettings> b)
    {
        b.ToTable("meta_conversion_settings");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.DatasetId).HasMaxLength(40);
        b.Property(x => x.AccessToken).HasMaxLength(4000);   // encrypted
        b.Property(x => x.LeadEvents);
        b.Property(x => x.DealEvents);
        b.Property(x => x.DefaultCallingCode).HasMaxLength(4);
        b.Property(x => x.DatasetName).HasMaxLength(300);
        b.Property(x => x.LastError).HasMaxLength(1000);
        // One link per integration. IntegrationId is a GUID, so it cannot collide across tenants.
        b.HasIndex(x => x.IntegrationId).IsUnique();
    }
}

internal sealed class MetaConversionEventConfiguration : IEntityTypeConfiguration<MetaConversionEvent>
{
    public void Configure(EntityTypeBuilder<MetaConversionEvent> b)
    {
        b.ToTable("meta_conversion_events");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.EventName).IsRequired().HasMaxLength(100);
        b.Property(x => x.MetaLeadId).IsRequired().HasMaxLength(40);
        b.Property(x => x.UserDataJson).IsRequired();
        b.Property(x => x.Value).HasPrecision(18, 2);
        b.Property(x => x.Currency).HasMaxLength(3);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.LastError).HasMaxLength(1000);

        // The sender's scan: "what is pending and due". Status first because almost every row ends up 'sent'.
        b.HasIndex(x => new { x.Status, x.NextAttemptAt });
        // "Has this lead been reported already?" and the per-integration log.
        b.HasIndex(x => new { x.IntegrationId, x.LeadId });
        b.HasIndex(x => new { x.IntegrationId, x.CreatedAt });
    }
}
