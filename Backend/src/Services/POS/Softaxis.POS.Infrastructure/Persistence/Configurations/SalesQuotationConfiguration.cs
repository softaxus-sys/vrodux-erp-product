using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class SalesQuotationConfiguration : IEntityTypeConfiguration<SalesQuotation>
{
    public void Configure(EntityTypeBuilder<SalesQuotation> builder)
    {
        builder.ToTable("sales_quotations");
        builder.HasKey(sq => sq.Id);
        builder.Property(sq => sq.Id).ValueGeneratedNever();
        builder.Property(sq => sq.QuotationNumber).HasMaxLength(30).IsRequired();
        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).
        builder.Property(sq => sq.CustomerName).HasMaxLength(200);
        builder.Property(sq => sq.Status).HasMaxLength(20).IsRequired();
        builder.Property(sq => sq.Notes).HasMaxLength(1000);
        builder.Property(sq => sq.ValidUntil).HasMaxLength(20);
        builder.HasQueryFilter(sq => !sq.IsDeleted);

        builder.HasOne(sq => sq.Customer)
            .WithMany()
            .HasForeignKey(sq => sq.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(sq => sq.Items)
            .WithOne(i => i.Quotation)
            .HasForeignKey(i => i.QuotationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SalesQuotationItemConfiguration : IEntityTypeConfiguration<SalesQuotationItem>
{
    public void Configure(EntityTypeBuilder<SalesQuotationItem> builder)
    {
        builder.ToTable("sales_quotation_items");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Description).HasMaxLength(500).IsRequired();
        builder.Property(i => i.Quantity).HasColumnType("decimal(18,4)");
        builder.Property(i => i.UnitPrice).HasColumnType("decimal(18,4)");
        builder.Property(i => i.DiscountPercent).HasColumnType("decimal(5,2)");
        builder.Property(i => i.TaxRate).HasColumnType("decimal(5,2)");

        builder.HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
