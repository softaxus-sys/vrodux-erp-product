using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class POSSessionConfiguration : IEntityTypeConfiguration<POSSession>
{
    public void Configure(EntityTypeBuilder<POSSession> builder)
    {
        builder.ToTable("pos_sessions");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();

        builder.Property(s => s.RegisterId)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(s => s.Notes)
            .HasMaxLength(1000);

        builder.Property(s => s.OpeningCash).HasPrecision(18, 2);
        builder.Property(s => s.ClosingCash).HasPrecision(18, 2);
        builder.Property(s => s.ExpectedCash).HasPrecision(18, 2);
        builder.Property(s => s.CashVariance).HasPrecision(18, 2);
        builder.Property(s => s.TotalSales).HasPrecision(18, 2);
        builder.Property(s => s.TotalRefunds).HasPrecision(18, 2);

        // Computed property — not stored
        builder.Ignore(s => s.NetSales);

        builder.HasIndex(s => s.CashierId);
        builder.HasIndex(s => new { s.RegisterId, s.Status });
    }
}
