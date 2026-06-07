using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> builder)
    {
        builder.ToTable("vendors");
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).ValueGeneratedNever();
        builder.Property(v => v.Name).HasMaxLength(200).IsRequired();
        builder.Property(v => v.Code).HasMaxLength(20);
        builder.HasIndex(v => v.Code).IsUnique().HasFilter("[IsDeleted] = 0 AND [Code] IS NOT NULL");
        builder.Property(v => v.Category).HasMaxLength(100);
        builder.Property(v => v.ContactPerson).HasMaxLength(150);
        builder.Property(v => v.Email).HasMaxLength(254);
        builder.Property(v => v.Phone).HasMaxLength(30);
        builder.Property(v => v.Address).HasMaxLength(500);
        builder.Property(v => v.TaxNumber).HasMaxLength(50);
        builder.Property(v => v.PaymentTerms).HasMaxLength(50);
        builder.Property(v => v.Currency).HasMaxLength(10);
        builder.Property(v => v.Notes).HasMaxLength(1000);
        builder.Property(v => v.Status).HasMaxLength(20);
        builder.Property(v => v.Rating).HasColumnType("decimal(3,1)");
        builder.HasQueryFilter(v => !v.IsDeleted);

        builder.HasMany(v => v.PurchaseOrders)
            .WithOne(po => po.Vendor)
            .HasForeignKey(po => po.VendorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
