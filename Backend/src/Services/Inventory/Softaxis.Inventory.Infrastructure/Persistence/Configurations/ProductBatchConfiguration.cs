using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class ProductBatchConfiguration : IEntityTypeConfiguration<ProductBatch>
{
    public void Configure(EntityTypeBuilder<ProductBatch> builder)
    {
        builder.ToTable("product_batches");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.BatchNumber).IsRequired().HasMaxLength(80);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.CostPrice).HasPrecision(18, 2);
        builder.Property(x => x.CreatedAt).IsRequired();

        builder.HasIndex(x => new { x.ProductId, x.WarehouseId, x.BatchNumber }).IsUnique();
        builder.HasIndex(x => x.ExpiryDate);

        builder.HasOne(x => x.Product)
               .WithMany()
               .HasForeignKey(x => x.ProductId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Warehouse)
               .WithMany()
               .HasForeignKey(x => x.WarehouseId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
