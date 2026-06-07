using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class ProductStockConfiguration : IEntityTypeConfiguration<ProductStock>
{
    public void Configure(EntityTypeBuilder<ProductStock> builder)
    {
        builder.ToTable("product_stock");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.ReorderLevel).HasPrecision(18, 4);
        builder.Property(x => x.CreatedAt).IsRequired();

        // One row per product+warehouse
        builder.HasIndex(x => new { x.ProductId, x.WarehouseId }).IsUnique();

        builder.HasOne(x => x.Product)
               .WithMany(p => p.StockLevels)
               .HasForeignKey(x => x.ProductId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Warehouse)
               .WithMany()
               .HasForeignKey(x => x.WarehouseId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
