using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Persistence.Configurations;

internal sealed class PurchaseReturnConfiguration : IEntityTypeConfiguration<PurchaseReturn>
{
    public void Configure(EntityTypeBuilder<PurchaseReturn> builder)
    {
        builder.ToTable("purchase_returns");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.ReturnNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ReturnDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Reason).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("posted");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.Ignore(x => x.TotalAmount);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.ReturnNumber).IsUnique();
        builder.HasIndex(x => x.PurchaseOrderId);
        builder.HasIndex(x => x.VendorId);

        builder.HasOne(x => x.PurchaseOrder)
               .WithMany()
               .HasForeignKey(x => x.PurchaseOrderId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Vendor)
               .WithMany()
               .HasForeignKey(x => x.VendorId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.PurchaseReturn)
               .HasForeignKey(x => x.PurchaseReturnId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class PurchaseReturnItemConfiguration : IEntityTypeConfiguration<PurchaseReturnItem>
{
    public void Configure(EntityTypeBuilder<PurchaseReturnItem> builder)
    {
        builder.ToTable("purchase_return_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);

        builder.Ignore(x => x.LineTotal);
    }
}
