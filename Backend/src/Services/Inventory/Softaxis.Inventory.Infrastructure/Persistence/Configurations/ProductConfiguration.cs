using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.SKU).HasMaxLength(100);
        builder.Property(x => x.Barcode).HasMaxLength(100);
        builder.Property(x => x.Unit).IsRequired().HasMaxLength(20).HasDefaultValue("pcs");
        builder.Property(x => x.SalePrice).HasPrecision(18, 2);
        builder.Property(x => x.CostPrice).HasPrecision(18, 2);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);
        builder.Property(x => x.StockQuantity).HasPrecision(18, 4);
        builder.Property(x => x.ReorderLevel).HasPrecision(18, 4);
        builder.Property(x => x.IsActive).IsRequired();
        builder.Property(x => x.TrackInventory).IsRequired();
        builder.Property(x => x.ImageUrl).HasMaxLength(500);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.SKU).IsUnique().HasFilter("[SKU] IS NOT NULL");
        builder.HasIndex(x => x.Barcode).HasFilter("[Barcode] IS NOT NULL");

        builder.HasOne(x => x.Category)
               .WithMany(x => x.Products)
               .HasForeignKey(x => x.CategoryId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Brand)
               .WithMany(x => x.Products)
               .HasForeignKey(x => x.BrandId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.UnitOfMeasure)
               .WithMany(x => x.Products)
               .HasForeignKey(x => x.UnitOfMeasureId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Movements)
               .WithOne(x => x.Product)
               .HasForeignKey(x => x.ProductId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
