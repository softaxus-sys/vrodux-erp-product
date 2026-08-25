using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Persistence.Configurations;

internal sealed class GoodsReceiptNoteConfiguration : IEntityTypeConfiguration<GoodsReceiptNote>
{
    public void Configure(EntityTypeBuilder<GoodsReceiptNote> builder)
    {
        builder.ToTable("goods_receipt_notes");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.GrnNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.GrnDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DriverName).HasMaxLength(200);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("posted");
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in PurchaseDbContext (needs the TenantId shadow column).
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
               .WithOne(x => x.GoodsReceiptNote)
               .HasForeignKey(x => x.GoodsReceiptNoteId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class GoodsReceiptNoteItemConfiguration : IEntityTypeConfiguration<GoodsReceiptNoteItem>
{
    public void Configure(EntityTypeBuilder<GoodsReceiptNoteItem> builder)
    {
        builder.ToTable("goods_receipt_note_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.OrderedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.ReceivedQuantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitCost).HasPrecision(18, 2);

        builder.Ignore(x => x.LineTotal);
    }
}
