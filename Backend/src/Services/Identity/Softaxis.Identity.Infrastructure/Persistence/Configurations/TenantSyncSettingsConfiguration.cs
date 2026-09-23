using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class TenantSyncSettingsConfiguration : IEntityTypeConfiguration<TenantSyncSettings>
{
    public void Configure(EntityTypeBuilder<TenantSyncSettings> builder)
    {
        builder.ToTable("tenant_sync_settings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.CloudBaseUrl).HasMaxLength(500).IsRequired();
        builder.Property(s => s.RunAtLocalTime).HasMaxLength(5).IsRequired();
        builder.Property(s => s.TimeZoneId).HasMaxLength(100).IsRequired();
        builder.Property(s => s.LastError).HasMaxLength(2000);

        // One row per tenant. An installation mirrors to exactly one cloud workspace; a second row
        // would mean two schedules pushing the same data to different places.
        builder.HasIndex(s => s.TenantId)
               .IsUnique()
               .HasFilter("[IsDeleted] = 0");
    }
}
