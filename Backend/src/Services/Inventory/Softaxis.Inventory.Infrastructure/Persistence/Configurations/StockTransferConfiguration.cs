using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Infrastructure.Persistence.Configurations;

internal sealed class StockTransferConfiguration : IEntityTypeConfiguration<StockTransfer>
{
    public void Configure(EntityTypeBuilder<StockTransfer> builder)
    {
        builder.ToTable("stock_transfers");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.TransferNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.FromWarehouseId).IsRequired().HasMaxLength(50);
        builder.Property(x => x.FromWarehouseName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ToWarehouseId).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ToWarehouseName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.RequestedBy).IsRequired().HasMaxLength(200);
        builder.Property(x => x.ApprovedBy).HasMaxLength(200);
        builder.Property(x => x.RequestDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ExpectedDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ReceivedDate).HasMaxLength(20);
        builder.Property(x => x.TotalValue).HasPrecision(18, 2);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);
        builder.HasMany(x => x.Items).WithOne(x => x.Transfer).HasForeignKey(x => x.TransferId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class StockTransferItemConfiguration : IEntityTypeConfiguration<StockTransferItem>
{
    public void Configure(EntityTypeBuilder<StockTransferItem> builder)
    {
        builder.ToTable("stock_transfer_items");
        builder.HasKey(x => x.Id); builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.StockItemId).IsRequired().HasMaxLength(50);
        builder.Property(x => x.ItemName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Sku).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Quantity).HasPrecision(18, 2);
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);
        builder.Ignore(x => x.Total);
    }
}
