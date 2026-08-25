using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence.Configurations;

internal sealed class SalesOrderConfiguration : IEntityTypeConfiguration<SalesOrder>
{
    public void Configure(EntityTypeBuilder<SalesOrder> builder)
    {
        builder.ToTable("sales_orders");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.OrderNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.CustomerName).HasMaxLength(200);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("pending");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.ExpectedDate).HasMaxLength(20);
        builder.Property(x => x.DeliveredDate).HasMaxLength(20);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in SalesDbContext (needs the TenantId shadow column).
        builder.HasIndex(x => x.Status);

        builder.HasOne(x => x.Customer)
               .WithMany(x => x.SalesOrders)
               .HasForeignKey(x => x.CustomerId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.SalesOrder)
               .HasForeignKey(x => x.SalesOrderId)
               .OnDelete(DeleteBehavior.Cascade);

        // Ignore computed properties
        builder.Ignore(x => x.SubTotal);
        builder.Ignore(x => x.TaxAmount);
        builder.Ignore(x => x.Total);
    }
}

internal sealed class SalesOrderItemConfiguration : IEntityTypeConfiguration<SalesOrderItem>
{
    public void Configure(EntityTypeBuilder<SalesOrderItem> builder)
    {
        builder.ToTable("sales_order_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Property(x => x.DiscountPercent).HasPrecision(5, 2);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);

        builder.Ignore(x => x.LineTotal);
    }
}
