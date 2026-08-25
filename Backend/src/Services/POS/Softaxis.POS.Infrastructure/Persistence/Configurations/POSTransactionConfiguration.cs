using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class POSTransactionConfiguration : IEntityTypeConfiguration<POSTransaction>
{
    public void Configure(EntityTypeBuilder<POSTransaction> builder)
    {
        builder.ToTable("pos_transactions");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();

        builder.Property(t => t.TransactionNumber)
            .IsRequired()
            .HasMaxLength(30);

        builder.Property(t => t.Notes)
            .HasMaxLength(1000);

        builder.Property(t => t.OrderDiscountType)
            .IsRequired()
            .HasMaxLength(20)
            .HasDefaultValue("none");

        builder.Property(t => t.OrderDiscountReference)
            .HasMaxLength(60);

        builder.Property(t => t.SubTotal).HasPrecision(18, 2);
        builder.Property(t => t.TaxAmount).HasPrecision(18, 2);
        builder.Property(t => t.DiscountAmount).HasPrecision(18, 2);
        builder.Property(t => t.TotalAmount).HasPrecision(18, 2);
        builder.Property(t => t.AmountPaid).HasPrecision(18, 2);
        builder.Property(t => t.ChangeGiven).HasPrecision(18, 2);

        // Computed
        builder.Ignore(t => t.IsCash);

        // Unique per tenant, live rows only — declared in POSDbContext (needs the TenantId shadow column).
        builder.HasIndex(t => t.SessionId);
        builder.HasIndex(t => t.CashierId);
        builder.HasIndex(t => t.CompletedAt);

        builder.HasOne(t => t.Session)
            .WithMany(s => s.Transactions)
            .HasForeignKey(t => t.SessionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.Customer)
            .WithMany(c => c.Transactions)
            .HasForeignKey(t => t.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
