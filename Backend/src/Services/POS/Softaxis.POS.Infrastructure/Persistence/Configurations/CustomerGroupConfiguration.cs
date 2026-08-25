using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class CustomerGroupConfiguration : IEntityTypeConfiguration<CustomerGroup>
{
    public void Configure(EntityTypeBuilder<CustomerGroup> builder)
    {
        builder.ToTable("customer_groups");

        builder.HasKey(g => g.Id);
        builder.Property(g => g.Id).ValueGeneratedNever();

        builder.Property(g => g.Name)           .IsRequired().HasMaxLength(100);
        builder.Property(g => g.Code)           .IsRequired().HasMaxLength(20);
        builder.Property(g => g.DiscountPercent).HasPrecision(5, 2);
        builder.Property(g => g.MinPurchase)    .HasPrecision(18, 2);
        builder.Property(g => g.Description)    .HasMaxLength(300);

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).

        builder.HasQueryFilter(g => !g.IsDeleted);

        // ── Seed ─────────────────────────────────────────────────────────────
        builder.HasData(
            Row("a0000004-0000-0000-0000-000000000001", "Walk-in",   "WALKIN",    0m,    0m,       "Standard walk-in customer",               true,  true),
            Row("a0000004-0000-0000-0000-000000000002", "Silver",    "SILVER",    5m,    10000m,   "5% discount, min purchase threshold",     false, true),
            Row("a0000004-0000-0000-0000-000000000003", "Gold",      "GOLD",      10m,   50000m,   "10% discount, mid-tier loyalty",          false, true),
            Row("a0000004-0000-0000-0000-000000000004", "Platinum",  "PLATINUM",  15m,   100000m,  "15% discount, premium loyalty tier",      false, true),
            Row("a0000004-0000-0000-0000-000000000005", "Wholesale", "WHOLESALE", 20m,   0m,       "Wholesale bulk purchasers, 20% discount", false, true),
            Row("a0000004-0000-0000-0000-000000000006", "Staff",     "STAFF",     25m,   0m,       "Employee purchase discount, 25% off",     false, true),
            Row("a0000004-0000-0000-0000-000000000007", "Corporate", "CORPORATE", 20m,   25000m,   "Corporate accounts, negotiated rate",     false, true)
        );
    }

    private static object Row(string id, string name, string code, decimal discountPercent,
        decimal minPurchase, string description, bool isDefault, bool isActive) => new
    {
        Id              = new Guid(id),
        Name            = name,
        Code            = code,
        DiscountPercent = discountPercent,
        MinPurchase     = minPurchase,
        Description     = (string?)description,
        IsDefault       = isDefault,
        IsActive        = isActive,
        IsSystem        = true,
        IsDeleted       = false,
        CreatedAt       = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        CreatedBy       = "system",
        UpdatedAt       = (DateTime?)null,
        UpdatedBy       = (string?)null,
        DeletedAt       = (DateTime?)null,
        DeletedBy       = (string?)null,
    };
}
