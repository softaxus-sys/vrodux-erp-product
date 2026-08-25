using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class CurrencyConfiguration : IEntityTypeConfiguration<Currency>
{
    public void Configure(EntityTypeBuilder<Currency> builder)
    {
        builder.ToTable("currencies");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();

        builder.Property(c => c.Code)   .IsRequired().HasMaxLength(10);
        builder.Property(c => c.Name)   .IsRequired().HasMaxLength(100);
        builder.Property(c => c.Symbol) .IsRequired().HasMaxLength(10);
        builder.Property(c => c.ExchangeRate).HasPrecision(18, 6);

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).

        builder.HasQueryFilter(c => !c.IsDeleted);

        // ── Seed — major world currencies ────────────────────────────────────
        builder.HasData(
            // Core
            Row("a0000001-0000-0000-0000-000000000001", "USD", "US Dollar",         "$",   1.000000m,  true,  true),
            Row("a0000001-0000-0000-0000-000000000002", "EUR", "Euro",              "€",   0.920000m,  false, true),
            Row("a0000001-0000-0000-0000-000000000003", "GBP", "British Pound",     "£",   0.790000m,  false, true),
            Row("a0000001-0000-0000-0000-000000000004", "PKR", "Pakistani Rupee",   "Rs",  278.50000m, false, true),
            Row("a0000001-0000-0000-0000-000000000005", "AED", "UAE Dirham",        "AED", 3.670000m,  false, true),
            Row("a0000001-0000-0000-0000-000000000006", "SAR", "Saudi Riyal",       "SAR", 3.750000m,  false, true),
            Row("a0000001-0000-0000-0000-000000000007", "INR", "Indian Rupee",      "Rs",  83.100000m, false, true),
            // Extended
            Row("a0000001-0000-0000-0000-000000000008", "CAD", "Canadian Dollar",   "C$",  1.360000m,  false, false),
            Row("a0000001-0000-0000-0000-000000000009", "AUD", "Australian Dollar", "A$",  1.530000m,  false, false),
            Row("a0000001-0000-0000-0000-00000000000a", "JPY", "Japanese Yen",      "JPY", 149.0000m,  false, false),
            Row("a0000001-0000-0000-0000-00000000000b", "QAR", "Qatari Riyal",      "QAR", 3.640000m,  false, true),
            Row("a0000001-0000-0000-0000-00000000000c", "KWD", "Kuwaiti Dinar",     "KWD", 0.310000m,  false, true),
            Row("a0000001-0000-0000-0000-00000000000d", "OMR", "Omani Rial",        "OMR", 0.385000m,  false, true),
            Row("a0000001-0000-0000-0000-00000000000e", "BHD", "Bahraini Dinar",    "BHD", 0.376000m,  false, true),
            Row("a0000001-0000-0000-0000-00000000000f", "TRY", "Turkish Lira",      "TRY", 32.100000m, false, false),
            Row("a0000001-0000-0000-0000-000000000010", "CHF", "Swiss Franc",       "CHF", 0.900000m,  false, false),
            Row("a0000001-0000-0000-0000-000000000011", "SGD", "Singapore Dollar",  "SGD", 1.340000m,  false, false),
            Row("a0000001-0000-0000-0000-000000000012", "MYR", "Malaysian Ringgit", "MYR", 4.700000m,  false, false),
            Row("a0000001-0000-0000-0000-000000000013", "CNY", "Chinese Yuan",      "CNY", 7.240000m,  false, false)
        );
    }

    private static object Row(string id, string code, string name, string symbol,
        decimal exchangeRate, bool isDefault, bool isActive) => new
    {
        Id           = new Guid(id),
        Code         = code,
        Name         = name,
        Symbol       = symbol,
        ExchangeRate = exchangeRate,
        IsDefault    = isDefault,
        IsActive     = isActive,
        IsSystem     = true,
        IsDeleted    = false,
        CreatedAt    = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        CreatedBy    = "system",
        UpdatedAt    = (DateTime?)null,
        UpdatedBy    = (string?)null,
        DeletedAt    = (DateTime?)null,
        DeletedBy    = (string?)null,
    };
}
