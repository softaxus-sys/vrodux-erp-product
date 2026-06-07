using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class TaxPeriodConfiguration : IEntityTypeConfiguration<TaxPeriod>
{
    public void Configure(EntityTypeBuilder<TaxPeriod> builder)
    {
        builder.ToTable("tax_periods");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Period).IsRequired().HasMaxLength(20);
        builder.Property(x => x.FromDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ToDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DueDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("open");
        builder.Property(x => x.OutputVat).HasPrecision(18, 2);
        builder.Property(x => x.InputVat).HasPrecision(18, 2);
        builder.Property(x => x.Penalty).HasPrecision(18, 2);
        builder.Property(x => x.FiledDate).HasMaxLength(20);
        builder.Property(x => x.PaidDate).HasMaxLength(20);

        // NetVat is a computed property — ignored by EF
        builder.Ignore(x => x.NetVat);

        builder.HasMany(x => x.Transactions)
               .WithOne(x => x.Period)
               .HasForeignKey(x => x.PeriodId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class TaxTransactionConfiguration : IEntityTypeConfiguration<TaxTransaction>
{
    public void Configure(EntityTypeBuilder<TaxTransaction> builder)
    {
        builder.ToTable("tax_transactions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Date).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Reference).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.VatAmount).HasPrecision(18, 2);
        builder.Property(x => x.VatRate).HasPrecision(5, 2);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(500);
    }
}
