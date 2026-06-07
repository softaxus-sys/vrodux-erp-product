using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("stock_movements");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.MovementType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);
        builder.Property(x => x.Reference).HasMaxLength(100);
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.Property(x => x.MovedAt).IsRequired();
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.ProductId);
        builder.HasIndex(x => x.MovementType);
        builder.HasIndex(x => x.MovedAt);

        builder.HasOne(x => x.Product)
               .WithMany(x => x.Movements)
               .HasForeignKey(x => x.ProductId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Warehouse)
               .WithMany(x => x.StockMovements)
               .HasForeignKey(x => x.WarehouseId)
               .OnDelete(DeleteBehavior.SetNull);
    }
}
