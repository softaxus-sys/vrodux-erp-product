using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class POSLineItemConfiguration : IEntityTypeConfiguration<POSLineItem>
{
    public void Configure(EntityTypeBuilder<POSLineItem> builder)
    {
        builder.ToTable("pos_line_items");

        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();

        builder.Property(i => i.ProductName).IsRequired().HasMaxLength(200);
        builder.Property(i => i.ProductSKU).HasMaxLength(50);
        builder.Property(i => i.ProductBarcode).HasMaxLength(50);
        builder.Property(i => i.Unit).IsRequired().HasMaxLength(20);
        builder.Property(i => i.Notes).HasMaxLength(500);

        builder.Property(i => i.UnitPrice).HasPrecision(18, 2);
        builder.Property(i => i.Quantity).HasPrecision(18, 3);
        builder.Property(i => i.DiscountPercent).HasPrecision(5, 2);
        builder.Property(i => i.DiscountAmount).HasPrecision(18, 2);
        builder.Property(i => i.TaxRate).HasPrecision(5, 2);
        builder.Property(i => i.TaxAmount).HasPrecision(18, 2);
        builder.Property(i => i.LineTotal).HasPrecision(18, 2);

        // Computed
        builder.Ignore(i => i.SubTotal);

        builder.HasOne(i => i.Transaction)
            .WithMany(t => t.LineItems)
            .HasForeignKey(i => i.TransactionId)
            .OnDelete(DeleteBehavior.Cascade);

        // ProductId is a cross-schema reference — products live in either
        // pos.products or inventory.products. No DB-level FK here; referential
        // integrity is enforced in the application layer (CrossSchemaProductService).
        builder.Ignore(i => i.Product);
    }
}
