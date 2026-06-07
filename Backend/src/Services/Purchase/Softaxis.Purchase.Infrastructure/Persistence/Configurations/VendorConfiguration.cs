using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Purchase.Domain.Entities;

namespace Softaxis.Purchase.Infrastructure.Persistence.Configurations;

internal sealed class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> builder)
    {
        builder.ToTable("vendors");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Code).HasMaxLength(30);
        builder.Property(x => x.Category).IsRequired().HasMaxLength(100).HasDefaultValue("General");
        builder.Property(x => x.ContactPerson).HasMaxLength(150);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(30);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.TaxNumber).HasMaxLength(50);
        builder.Property(x => x.PaymentTerms).IsRequired().HasMaxLength(50).HasDefaultValue("Net 30");
        builder.Property(x => x.Currency).IsRequired().HasMaxLength(10).HasDefaultValue("PKR");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("active");
        builder.Property(x => x.Rating).HasPrecision(3, 1);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.Code).HasFilter("[Code] IS NOT NULL");
        builder.HasIndex(x => x.Status);

        builder.HasMany(x => x.PurchaseOrders)
               .WithOne(x => x.Vendor)
               .HasForeignKey(x => x.VendorId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
