using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class CreditPricingSettingsConfiguration : IEntityTypeConfiguration<CreditPricingSettings>
{
    private static readonly JsonSerializerOptions Json = new();

    public void Configure(EntityTypeBuilder<CreditPricingSettings> b)
    {
        b.ToTable("credit_pricing_settings");
        b.HasKey(s => s.Id);
        b.Property(s => s.Id).ValueGeneratedNever();
        b.Property(s => s.MinOrderUsd).HasPrecision(18, 2);
        b.Property(s => s.MaxOrderUsd).HasPrecision(18, 2);
        b.Property(s => s.VatPercent).HasPrecision(5, 2);
        b.Property(s => s.SwapFeePercent).HasPrecision(5, 2);
        b.Property(s => s.UpdatedBy).HasMaxLength(200);

        // Small, always read together: JSON columns, with comparers so an in-place edit is actually saved.
        b.Property(s => s.PricePerCredit)
            .HasConversion(
                v => JsonSerializer.Serialize(v, Json),
                v => JsonSerializer.Deserialize<Dictionary<string, decimal>>(v, Json) ?? new Dictionary<string, decimal>(),
                new ValueComparer<Dictionary<string, decimal>>(
                    (a, c) => a != null && c != null && a.Count == c.Count && !a.Except(c).Any(),
                    v => v.Aggregate(0, (acc, kv) => HashCode.Combine(acc, kv.Key.GetHashCode(), kv.Value.GetHashCode())),
                    v => new Dictionary<string, decimal>(v)))
            .HasColumnType("nvarchar(max)");

        b.Property(s => s.Tiers)
            .HasConversion(
                v => JsonSerializer.Serialize(v, Json),
                v => JsonSerializer.Deserialize<List<CreditTier>>(v, Json) ?? new List<CreditTier>(),
                new ValueComparer<List<CreditTier>>(
                    (a, c) => a != null && c != null && a.SequenceEqual(c),
                    v => v.Aggregate(0, (acc, t) => HashCode.Combine(acc, t.FromCredits, t.DiscountPercent)),
                    v => v.ToList()))
            .HasColumnType("nvarchar(max)");
    }
}

public sealed class CreditPurchaseConfiguration : IEntityTypeConfiguration<CreditPurchase>
{
    public void Configure(EntityTypeBuilder<CreditPurchase> b)
    {
        b.ToTable("credit_purchases");
        b.HasKey(p => p.Id);
        b.Property(p => p.Id).ValueGeneratedNever();
        b.Property(p => p.ModuleKey).HasMaxLength(50).IsRequired();
        b.Property(p => p.UnitPrice).HasPrecision(18, 4);
        b.Property(p => p.DiscountPercent).HasPrecision(5, 2);
        b.Property(p => p.NetAmount).HasPrecision(18, 2);
        b.Property(p => p.VatAmount).HasPrecision(18, 2);
        b.Property(p => p.TotalAmount).HasPrecision(18, 2);
        b.Property(p => p.Currency).HasMaxLength(3).IsRequired();
        b.Property(p => p.Status).HasMaxLength(20).IsRequired();
        b.Property(p => p.ProviderRef).HasMaxLength(200);
        b.Property(p => p.ProviderPaymentId).HasMaxLength(200);
        b.Property(p => p.Error).HasMaxLength(500);
        b.Property(p => p.CreatedByName).HasMaxLength(200);
        b.HasIndex(p => new { p.TenantId, p.CreatedAt });
        // A provider reference identifies one purchase, so a replayed return/webhook cannot match two.
        b.HasIndex(p => new { p.Provider, p.ProviderRef }).IsUnique().HasFilter("[ProviderRef] IS NOT NULL");
    }
}

public sealed class CreditSwapConfiguration : IEntityTypeConfiguration<CreditSwap>
{
    public void Configure(EntityTypeBuilder<CreditSwap> b)
    {
        b.ToTable("credit_swaps");
        b.HasKey(p => p.Id);
        b.Property(p => p.Id).ValueGeneratedNever();
        b.Property(p => p.FromModule).HasMaxLength(50).IsRequired();
        b.Property(p => p.ToModule).HasMaxLength(50).IsRequired();
        b.Property(p => p.FromPrice).HasPrecision(18, 4);
        b.Property(p => p.ToPrice).HasPrecision(18, 4);
        b.Property(p => p.FeePercent).HasPrecision(5, 2);
        b.Property(p => p.Status).HasMaxLength(20).IsRequired();
        b.Property(p => p.Error).HasMaxLength(500);
        b.Property(p => p.CreatedByName).HasMaxLength(200);
        b.HasIndex(p => new { p.TenantId, p.CreatedAt });
    }
}
