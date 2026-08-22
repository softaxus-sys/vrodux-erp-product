using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class AppSettingConfiguration : IEntityTypeConfiguration<AppSetting>
{
    public void Configure(EntityTypeBuilder<AppSetting> builder)
    {
        builder.ToTable("app_settings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.Category).HasMaxLength(50).IsRequired();
        builder.Property(s => s.Key).HasMaxLength(100).IsRequired();
        builder.Property(s => s.Value).HasColumnType("nvarchar(max)");
        builder.Property(s => s.UpdatedBy).HasMaxLength(100);
        builder.Property(s => s.UserId).HasMaxLength(100).IsRequired(false);

        // Uniqueness is per TENANT. Without TenantId in these indexes a setting key could exist only
        // once across the whole platform: the first tenant to save "notifications/emailSystem" locked
        // every other tenant out of that key, and their save failed with a duplicate-key error even
        // though the repository (correctly) scopes reads by tenant and so never found a row to update.
        //
        // SQL Server treats NULLs as equal for uniqueness, so pre-tenant legacy rows (TenantId NULL)
        // stay unique among themselves and no longer collide with any tenant's own row.

        // Company-wide: unique on (TenantId, Category, Key) where UserId IS NULL
        builder.HasIndex(s => new { s.TenantId, s.Category, s.Key })
               .IsUnique()
               .HasFilter("[UserId] IS NULL");

        // Per-user: unique on (TenantId, Category, Key, UserId) where UserId IS NOT NULL
        builder.HasIndex(s => new { s.TenantId, s.Category, s.Key, s.UserId })
               .IsUnique()
               .HasFilter("[UserId] IS NOT NULL");
    }
}
