using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(c => c.Phone)
            .HasMaxLength(30);

        builder.Property(c => c.Email)
            .HasMaxLength(254);

        builder.Property(c => c.Address)
            .HasMaxLength(500);

        builder.Property(c => c.Notes)
            .HasMaxLength(1000);

        builder.Property(c => c.LoyaltyPoints)
            .HasPrecision(18, 2);

        builder.Property(c => c.TotalPurchases)
            .HasPrecision(18, 2);

        builder.Property(c => c.WalletBalance)
            .HasPrecision(18, 2);

        builder.Property(c => c.CreditLimit)
            .HasPrecision(18, 2);

        builder.Property(c => c.CreditBalance)
            .HasPrecision(18, 2);

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).

        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}
