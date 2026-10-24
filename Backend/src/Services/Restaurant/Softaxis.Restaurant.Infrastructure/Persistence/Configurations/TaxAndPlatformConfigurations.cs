using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Persistence.Configurations;

public sealed class TaxProfileConfiguration : IEntityTypeConfiguration<TaxProfile>
{
    public void Configure(EntityTypeBuilder<TaxProfile> b)
    {
        b.ToTable("TaxProfiles");
        b.HasKey(x => x.Id);
        b.Property(x => x.CountryCode).HasMaxLength(2).IsRequired();
        b.Property(x => x.RegionCode).HasMaxLength(20);
        b.Property(x => x.TaxLabel).HasMaxLength(20).IsRequired();
        b.Property(x => x.RatePercent).HasPrecision(5, 2);
        b.Property(x => x.FbrEnvironment).HasMaxLength(20).IsRequired();
        b.Property(x => x.FbrTokenEncrypted).HasMaxLength(2000);
        b.Property(x => x.FbrServiceFee).HasPrecision(18, 2);
        b.Property(x => x.FbrPctCode).HasMaxLength(20).IsRequired();
        b.HasIndex(x => x.BranchId);
    }
}

public sealed class PlatformConnectionConfiguration : IEntityTypeConfiguration<PlatformConnection>
{
    public void Configure(EntityTypeBuilder<PlatformConnection> b)
    {
        b.ToTable("PlatformConnections");
        b.HasKey(x => x.Id);
        b.Property(x => x.Platform).HasMaxLength(30).IsRequired();
        b.Property(x => x.Environment).HasMaxLength(20).IsRequired();
        b.Property(x => x.RemoteId).HasMaxLength(100).IsRequired();
        b.Property(x => x.InboundKey).HasMaxLength(64).IsRequired();
        b.Property(x => x.Username).HasMaxLength(200);
        b.Property(x => x.PasswordEncrypted).HasMaxLength(2000);
        b.Property(x => x.PluginSecretEncrypted).HasMaxLength(2000);
        b.Property(x => x.LastError).HasMaxLength(500);
        // Resolved with no tenant context (anonymous platform calls), so unique across all workspaces.
        b.HasIndex(x => x.InboundKey).IsUnique();
        b.HasIndex(x => x.BranchId);
    }
}
