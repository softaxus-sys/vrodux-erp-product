using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class PaymentTermConfiguration : IEntityTypeConfiguration<PaymentTerm>
{
    public void Configure(EntityTypeBuilder<PaymentTerm> builder)
    {
        builder.ToTable("payment_terms");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Name)         .IsRequired().HasMaxLength(100);
        builder.Property(p => p.Code)         .IsRequired().HasMaxLength(20);
        builder.Property(p => p.AdvancePercent).HasPrecision(5, 2);
        builder.Property(p => p.Description)  .HasMaxLength(300);

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).

        builder.HasQueryFilter(p => !p.IsDeleted);

        // ── Seed ─────────────────────────────────────────────────────────────
        builder.HasData(
            Row("a0000003-0000-0000-0000-000000000001", "Immediate",        "IMMEDIATE", 0,  0m,   "Payment due immediately on invoice",           true),
            Row("a0000003-0000-0000-0000-000000000002", "Cash on Delivery", "COD",       0,  0m,   "Full payment collected on delivery",           false),
            Row("a0000003-0000-0000-0000-000000000003", "Prepaid",          "PRE",       0,  100m, "Full prepayment required before dispatch",     false),
            Row("a0000003-0000-0000-0000-000000000004", "Net 15",           "NET15",     15, 0m,   "Payment due within 15 days of invoice",        false),
            Row("a0000003-0000-0000-0000-000000000005", "Net 30",           "NET30",     30, 0m,   "Payment due within 30 days of invoice",        false),
            Row("a0000003-0000-0000-0000-000000000006", "Net 45",           "NET45",     45, 0m,   "Payment due within 45 days of invoice",        false),
            Row("a0000003-0000-0000-0000-000000000007", "Net 60",           "NET60",     60, 0m,   "Payment due within 60 days of invoice",        false),
            Row("a0000003-0000-0000-0000-000000000008", "Net 90",           "NET90",     90, 0m,   "Payment due within 90 days of invoice",        false),
            Row("a0000003-0000-0000-0000-000000000009", "30% Advance",      "ADV30",     30, 30m,  "30% advance required, balance within 30 days", false),
            Row("a0000003-0000-0000-0000-00000000000a", "50% Advance",      "ADV50",     30, 50m,  "50% advance required, balance within 30 days", false),
            Row("a0000003-0000-0000-0000-00000000000b", "2/10 Net 30",      "2NET30",    30, 0m,   "2% discount if paid within 10 days, else Net 30", false)
        );
    }

    private static object Row(string id, string name, string code, int daysNet,
        decimal advancePercent, string description, bool isDefault) => new
    {
        Id             = new Guid(id),
        Name           = name,
        Code           = code,
        DaysNet        = daysNet,
        AdvancePercent = advancePercent,
        Description    = (string?)description,
        IsDefault      = isDefault,
        IsSystem       = true,
        IsDeleted      = false,
        CreatedAt      = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        CreatedBy      = "system",
        UpdatedAt      = (DateTime?)null,
        UpdatedBy      = (string?)null,
        DeletedAt      = (DateTime?)null,
        DeletedBy      = (string?)null,
    };
}
