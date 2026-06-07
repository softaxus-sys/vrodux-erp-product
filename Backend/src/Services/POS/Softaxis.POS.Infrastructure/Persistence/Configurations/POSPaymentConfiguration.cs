using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class POSPaymentConfiguration : IEntityTypeConfiguration<POSPayment>
{
    public void Configure(EntityTypeBuilder<POSPayment> builder)
    {
        builder.ToTable("pos_payments");

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();

        builder.Property(p => p.Reference).HasMaxLength(100);
        builder.Property(p => p.Amount).HasPrecision(18, 2);

        builder.HasOne(p => p.Transaction)
            .WithMany(t => t.Payments)
            .HasForeignKey(p => p.TransactionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
