using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class TaxRateConfiguration : IEntityTypeConfiguration<TaxRate>
{
    public void Configure(EntityTypeBuilder<TaxRate> builder)
    {
        builder.ToTable("tax_rates");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.Name)       .IsRequired().HasMaxLength(100);
        builder.Property(t => t.Code)       .IsRequired().HasMaxLength(20);
        builder.Property(t => t.Rate)       .HasPrecision(8, 4);
        builder.Property(t => t.AppliesTo)  .IsRequired().HasMaxLength(20);
        builder.Property(t => t.Description).HasMaxLength(300);

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).

        builder.HasQueryFilter(t => !t.IsDeleted);

        // ── Seed ─────────────────────────────────────────────────────────────
        builder.HasData(
            Row("a0000002-0000-0000-0000-000000000001", "Tax Exempt",       "EXEMPT",  0.00m,  "all",      "No tax applies — zero-rated",           true,  true),
            Row("a0000002-0000-0000-0000-000000000002", "Standard VAT 15%", "VAT15",   15.00m, "all",      "Standard VAT — common global rate",     false, true),
            Row("a0000002-0000-0000-0000-000000000003", "Pakistan GST 17%", "GST17",   17.00m, "goods",    "Pakistan general sales tax",            false, true),
            Row("a0000002-0000-0000-0000-000000000004", "Pakistan GST 5%",  "GST5",    5.00m,  "goods",    "Reduced rate for essential goods (PK)", false, true),
            Row("a0000002-0000-0000-0000-000000000005", "UAE VAT 5%",       "VAT5AE",  5.00m,  "all",      "UAE Federal VAT",                       false, true),
            Row("a0000002-0000-0000-0000-000000000006", "Saudi VAT 15%",    "VAT15SA", 15.00m, "all",      "Saudi Arabia VAT (post-2020)",           false, true),
            Row("a0000002-0000-0000-0000-000000000007", "India GST 18%",    "GST18IN", 18.00m, "all",      "India GST — standard rate",             false, true),
            Row("a0000002-0000-0000-0000-000000000008", "India GST 5%",     "GST5IN",  5.00m,  "goods",    "India GST — reduced rate",              false, false),
            Row("a0000002-0000-0000-0000-000000000009", "UK Standard VAT",  "UK20",    20.00m, "all",      "UK standard VAT 20%",                   false, true),
            Row("a0000002-0000-0000-0000-00000000000a", "UK Reduced VAT",   "UK5",     5.00m,  "all",      "UK reduced VAT 5%",                     false, true),
            Row("a0000002-0000-0000-0000-00000000000b", "EU Standard VAT",  "EU20",    20.00m, "all",      "EU typical standard rate",              false, false)
        );
    }

    private static object Row(string id, string name, string code, decimal rate,
        string appliesTo, string description, bool isDefault, bool isActive) => new
    {
        Id          = new Guid(id),
        Name        = name,
        Code        = code,
        Rate        = rate,
        AppliesTo   = appliesTo,
        Description = (string?)description,
        IsDefault   = isDefault,
        IsActive    = isActive,
        IsSystem    = true,
        IsDeleted   = false,
        CreatedAt   = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        CreatedBy   = "system",
        UpdatedAt   = (DateTime?)null,
        UpdatedBy   = (string?)null,
        DeletedAt   = (DateTime?)null,
        DeletedBy   = (string?)null,
    };
}
