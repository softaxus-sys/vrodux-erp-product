using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class PurchaseBillConfiguration : IEntityTypeConfiguration<PurchaseBill>
{
    public void Configure(EntityTypeBuilder<PurchaseBill> builder)
    {
        builder.ToTable("purchase_bills");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.BillNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.SupplierName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.BillDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DueDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);
        builder.Property(x => x.AmountPaid).HasPrecision(18, 2);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3).HasDefaultValue("AED");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.Reference).HasMaxLength(100);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        // Computed — not mapped
        builder.Ignore(x => x.SubTotal);
        builder.Ignore(x => x.TaxAmount);
        builder.Ignore(x => x.Total);
        builder.Ignore(x => x.AmountDue);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.BillNumber).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.DueDate);
        builder.HasIndex(x => x.SupplierId);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.Bill)
               .HasForeignKey(x => x.BillId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Supplier>()
               .WithMany()
               .HasForeignKey(x => x.SupplierId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class PurchaseBillItemConfiguration : IEntityTypeConfiguration<PurchaseBillItem>
{
    public void Configure(EntityTypeBuilder<PurchaseBillItem> builder)
    {
        builder.ToTable("purchase_bill_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);

        builder.Ignore(x => x.LineTotal);

        builder.HasIndex(x => x.BillId);
    }
}
