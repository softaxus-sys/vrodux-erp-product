using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.ValueObjects;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(p => p.Description)
            .HasMaxLength(1000);

        builder.Property(p => p.SKU)
            .HasMaxLength(50);

        builder.Property(p => p.Barcode)
            .HasMaxLength(50)
            .HasConversion(
                b => b == null ? null : b.Value,
                v => v == null ? null : Barcode.Create(v).Value);

        builder.Property(p => p.Unit)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("pcs");

        builder.Property(p => p.SalePrice)
            .HasPrecision(18, 2);

        builder.Property(p => p.CostPrice)
            .HasPrecision(18, 2);

        builder.Property(p => p.TaxRate)
            .HasPrecision(5, 2);

        builder.Property(p => p.StockQuantity)
            .HasPrecision(18, 3);

        builder.Property(p => p.ReorderLevel)
            .HasPrecision(18, 3);

        builder.Property(p => p.ImageUrl)
            .HasMaxLength(500);

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).

        builder.HasIndex(p => p.CategoryId);

        // Computed property — not stored
        builder.Ignore(p => p.IsLowStock);

        // LineItems are related to POSLineItem.ProductId but that FK is intentionally
        // removed (products can live in pos or inventory schema). Ignore the collection.
        builder.Ignore(p => p.LineItems);

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(p => !p.IsDeleted);
    }
}
