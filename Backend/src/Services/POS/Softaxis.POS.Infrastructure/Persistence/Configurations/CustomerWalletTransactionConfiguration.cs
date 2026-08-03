using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class CustomerWalletTransactionConfiguration : IEntityTypeConfiguration<CustomerWalletTransaction>
{
    public void Configure(EntityTypeBuilder<CustomerWalletTransaction> builder)
    {
        builder.ToTable("customer_wallet_transactions");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Type)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(x => x.Amount)
            .HasPrecision(18, 2);

        builder.Property(x => x.Notes)
            .HasMaxLength(500);

        builder.HasIndex(x => x.CustomerId);
        builder.HasIndex(x => x.OrderId);
    }
}
