using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class TenantSsoSettingsConfiguration : IEntityTypeConfiguration<TenantSsoSettings>
{
    public void Configure(EntityTypeBuilder<TenantSsoSettings> b)
    {
        b.ToTable("tenant_sso_settings");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.DirectoryId).HasMaxLength(64);
        b.Property(x => x.ClientId).HasMaxLength(64);
        b.Property(x => x.ClientSecretCipher).HasMaxLength(2000);
        b.Property(x => x.UpdatedBy).HasMaxLength(200);
        b.HasIndex(x => x.TenantId).IsUnique();
    }
}
