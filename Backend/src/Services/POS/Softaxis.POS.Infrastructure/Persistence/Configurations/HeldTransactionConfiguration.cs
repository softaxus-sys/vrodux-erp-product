using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class HeldTransactionConfiguration : IEntityTypeConfiguration<HeldTransaction>
{
    public void Configure(EntityTypeBuilder<HeldTransaction> builder)
    {
        builder.ToTable("held_transactions");

        builder.HasKey(h => h.Id);
        builder.Property(h => h.Id).ValueGeneratedNever();

        builder.Property(h => h.Label).IsRequired().HasMaxLength(100);
        builder.Property(h => h.ItemsJson).IsRequired().HasColumnType("nvarchar(max)");

        builder.HasOne(h => h.Session)
            .WithMany(s => s.HeldTransactions)
            .HasForeignKey(h => h.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(h => new { h.SessionId, h.IsRecalled });
    }
}
