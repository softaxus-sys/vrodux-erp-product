using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("purchase_orders");
        builder.HasKey(po => po.Id);
        builder.Property(po => po.Id).ValueGeneratedNever();
        builder.Property(po => po.OrderNumber).HasMaxLength(30).IsRequired();
        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).
        builder.Property(po => po.Status).HasMaxLength(20).IsRequired();
        builder.Property(po => po.Notes).HasMaxLength(1000);
        builder.Property(po => po.ExpectedDate).HasMaxLength(20);
        builder.Property(po => po.ReceivedDate).HasMaxLength(20);
        builder.HasQueryFilter(po => !po.IsDeleted);

        builder.HasOne(po => po.Vendor)
            .WithMany(v => v.PurchaseOrders)
            .HasForeignKey(po => po.VendorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(po => po.Items)
            .WithOne(i => i.PurchaseOrder)
            .HasForeignKey(i => i.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PurchaseOrderItemConfiguration : IEntityTypeConfiguration<PurchaseOrderItem>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderItem> builder)
    {
        builder.ToTable("purchase_order_items");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Description).HasMaxLength(500).IsRequired();
        builder.Property(i => i.Quantity).HasColumnType("decimal(18,4)");
        builder.Property(i => i.UnitCost).HasColumnType("decimal(18,4)");
        builder.Property(i => i.TaxRate).HasColumnType("decimal(5,2)");

        builder.HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
