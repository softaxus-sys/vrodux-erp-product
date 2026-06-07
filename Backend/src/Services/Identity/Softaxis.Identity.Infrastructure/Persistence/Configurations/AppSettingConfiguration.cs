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

        // Company-wide: unique on (Category, Key) where UserId IS NULL
        builder.HasIndex(s => new { s.Category, s.Key })
               .IsUnique()
               .HasFilter("[UserId] IS NULL");

        // Per-user: unique on (Category, Key, UserId) where UserId IS NOT NULL
        builder.HasIndex(s => new { s.Category, s.Key, s.UserId })
               .IsUnique()
               .HasFilter("[UserId] IS NOT NULL");
    }
}
