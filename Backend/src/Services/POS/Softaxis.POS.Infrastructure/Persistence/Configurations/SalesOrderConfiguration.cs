using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class SalesOrderConfiguration : IEntityTypeConfiguration<SalesOrder>
{
    public void Configure(EntityTypeBuilder<SalesOrder> builder)
    {
        builder.ToTable("sales_orders");
        builder.HasKey(so => so.Id);
        builder.Property(so => so.Id).ValueGeneratedNever();
        builder.Property(so => so.OrderNumber).HasMaxLength(30).IsRequired();
        builder.HasIndex(so => so.OrderNumber).IsUnique();
        builder.Property(so => so.CustomerName).HasMaxLength(200);
        builder.Property(so => so.Status).HasMaxLength(20).IsRequired();
        builder.Property(so => so.Notes).HasMaxLength(1000);
        builder.Property(so => so.ExpectedDate).HasMaxLength(20);
        builder.Property(so => so.DeliveredDate).HasMaxLength(20);
        builder.HasQueryFilter(so => !so.IsDeleted);

        builder.HasOne(so => so.Customer)
            .WithMany()
            .HasForeignKey(so => so.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(so => so.Items)
            .WithOne(i => i.SalesOrder)
            .HasForeignKey(i => i.SalesOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SalesOrderItemConfiguration : IEntityTypeConfiguration<SalesOrderItem>
{
    public void Configure(EntityTypeBuilder<SalesOrderItem> builder)
    {
        builder.ToTable("sales_order_items");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Description).HasMaxLength(500).IsRequired();
        builder.Property(i => i.Quantity).HasColumnType("decimal(18,4)");
        builder.Property(i => i.UnitPrice).HasColumnType("decimal(18,4)");
        builder.Property(i => i.DiscountPercent).HasColumnType("decimal(5,2)");
        builder.Property(i => i.TaxRate).HasColumnType("decimal(5,2)");

        builder.HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
