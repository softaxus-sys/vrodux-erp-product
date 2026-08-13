using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Infrastructure.Persistence.Configurations;

public sealed class BillingSettingsConfiguration : IEntityTypeConfiguration<BillingSettings>
{
    public void Configure(EntityTypeBuilder<BillingSettings> builder)
    {
        builder.ToTable("billing_settings");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.Currency).HasMaxLength(3);
        builder.Property(s => s.UpdatedBy).HasMaxLength(200);

        // Price/plan ids are a small, always-read-together map — a JSON column keeps them with the
        // row instead of adding a child table whose only purpose would be a dozen key/value pairs.
        builder.Property(s => s.StripePrices).HasIdMapConversion();
        builder.Property(s => s.PayPalPlans).HasIdMapConversion();
    }
}

internal static class BillingSettingsMapConversions
{
    private static readonly JsonSerializerOptions Json = new();

    /// <summary>
    /// Dictionary &lt;-&gt; JSON, with a value comparer. Without the comparer EF compares dictionary
    /// instances by reference and never detects an in-place edit, so a saved change to the ids
    /// would silently do nothing.
    /// </summary>
    public static PropertyBuilder<Dictionary<string, string>> HasIdMapConversion(
        this PropertyBuilder<Dictionary<string, string>> builder) =>
        builder
            .HasConversion(
                v => JsonSerializer.Serialize(v, Json),
                v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, Json) ?? new Dictionary<string, string>(),
                new ValueComparer<Dictionary<string, string>>(
                    (a, b) => a != null && b != null && a.Count == b.Count && !a.Except(b).Any(),
                    v => v.Aggregate(0, (acc, kv) => HashCode.Combine(acc, kv.Key.GetHashCode(), kv.Value.GetHashCode())),
                    v => new Dictionary<string, string>(v)))
            .HasColumnType("nvarchar(max)");
}
