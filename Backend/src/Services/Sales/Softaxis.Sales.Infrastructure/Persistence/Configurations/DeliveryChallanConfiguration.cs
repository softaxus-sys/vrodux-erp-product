using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence.Configurations;

internal sealed class DeliveryChallanConfiguration : IEntityTypeConfiguration<DeliveryChallan>
{
    public void Configure(EntityTypeBuilder<DeliveryChallan> builder)
    {
        builder.ToTable("delivery_challans");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.ChallanNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ChallanDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DriverName).HasMaxLength(200);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("posted");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.ChallanNumber).IsUnique();
        builder.HasIndex(x => x.SalesOrderId);
        builder.HasIndex(x => x.CustomerId);

        builder.HasOne(x => x.SalesOrder)
               .WithMany()
               .HasForeignKey(x => x.SalesOrderId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Customer)
               .WithMany()
               .HasForeignKey(x => x.CustomerId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.DeliveryChallan)
               .HasForeignKey(x => x.DeliveryChallanId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class DeliveryChallanItemConfiguration : IEntityTypeConfiguration<DeliveryChallanItem>
{
    public void Configure(EntityTypeBuilder<DeliveryChallanItem> builder)
    {
        builder.ToTable("delivery_challan_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.OrderedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.DeliveredQuantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);

        builder.Ignore(x => x.LineTotal);
    }
}
