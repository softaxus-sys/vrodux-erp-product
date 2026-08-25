using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Persistence.Configurations;

internal sealed class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("purchase_orders");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.OrderNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("draft");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.ExpectedDate).HasMaxLength(20);
        builder.Property(x => x.ReceivedDate).HasMaxLength(20);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in PurchaseDbContext (needs the TenantId shadow column).
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.VendorId);

        builder.HasOne(x => x.Vendor)
               .WithMany(x => x.PurchaseOrders)
               .HasForeignKey(x => x.VendorId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.PurchaseOrder)
               .HasForeignKey(x => x.PurchaseOrderId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(x => x.SubTotal);
        builder.Ignore(x => x.TaxAmount);
        builder.Ignore(x => x.Total);
    }
}

internal sealed class PurchaseOrderItemConfiguration : IEntityTypeConfiguration<PurchaseOrderItem>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderItem> builder)
    {
        builder.ToTable("purchase_order_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);

        builder.Ignore(x => x.LineTotal);
    }
}
