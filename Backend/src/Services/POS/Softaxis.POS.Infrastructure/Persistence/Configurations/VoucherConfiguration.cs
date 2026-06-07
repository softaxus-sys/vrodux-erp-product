using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class VoucherConfiguration : IEntityTypeConfiguration<Voucher>
{
    public void Configure(EntityTypeBuilder<Voucher> builder)
    {
        builder.ToTable("vouchers");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();

        builder.Property(v => v.Code)        .IsRequired().HasMaxLength(40);
        builder.Property(v => v.Description) .HasMaxLength(300);
        builder.Property(v => v.ValueType)   .HasConversion<int>();
        builder.Property(v => v.Value)            .HasPrecision(18, 2);
        builder.Property(v => v.MinSpend)         .HasPrecision(18, 2);
        builder.Property(v => v.MaxDiscountAmount).HasPrecision(18, 2);

        builder.HasIndex(v => v.Code)
            .IsUnique()
            .HasFilter("[IsDeleted] = 0");

        builder.HasQueryFilter(v => !v.IsDeleted);

        // ── Seed demo vouchers ───────────────────────────────────────────────
        builder.HasData(
            Row("c0000001-0000-0000-0000-000000000001", "SAVE10", "10% off — min spend 100",
                valueType: VoucherValueType.Percentage,  value: 10m, minSpend: 100m, maxDiscount: 500m,
                usageLimit: 1000),
            Row("c0000001-0000-0000-0000-000000000002", "FLAT50", "Flat 50 off — min spend 300",
                valueType: VoucherValueType.FixedAmount, value: 50m, minSpend: 300m, maxDiscount: null,
                usageLimit: null),
            Row("c0000001-0000-0000-0000-000000000003", "WELCOME", "15% welcome discount",
                valueType: VoucherValueType.Percentage,  value: 15m, minSpend: 0m,   maxDiscount: 1000m,
                usageLimit: null)
        );
    }

    private static object Row(string id, string code, string description,
        VoucherValueType valueType, decimal value, decimal minSpend, decimal? maxDiscount, int? usageLimit) => new
    {
        Id                = new Guid(id),
        Code              = code,
        Description       = (string?)description,
        ValueType         = valueType,
        Value             = value,
        MinSpend          = minSpend,
        MaxDiscountAmount = maxDiscount,
        ValidFrom         = (DateTime?)null,
        ValidUntil        = (DateTime?)null,
        UsageLimit        = usageLimit,
        UsageCount        = 0,
        IsActive          = true,
        IsDeleted         = false,
        CreatedAt         = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        CreatedBy         = "system",
        UpdatedAt         = (DateTime?)null,
        UpdatedBy         = (string?)null,
        DeletedAt         = (DateTime?)null,
        DeletedBy         = (string?)null,
    };
}
