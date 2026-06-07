using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class BankAccountConfiguration : IEntityTypeConfiguration<BankAccount>
{
    public void Configure(EntityTypeBuilder<BankAccount> builder)
    {
        builder.ToTable("bank_accounts");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.AccountName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.BankName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.AccountNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Iban).IsRequired().HasMaxLength(34);
        builder.Property(x => x.Currency).IsRequired().HasMaxLength(10);
        builder.Property(x => x.Balance).HasPrecision(18, 2);
        builder.Property(x => x.AvailableBalance).HasPrecision(18, 2);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("active");
        builder.Property(x => x.AccountType).IsRequired().HasMaxLength(20).HasDefaultValue("current");
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);

        builder.HasMany(x => x.Transactions)
               .WithOne(x => x.Account)
               .HasForeignKey(x => x.AccountId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class BankTransactionConfiguration : IEntityTypeConfiguration<BankTransaction>
{
    public void Configure(EntityTypeBuilder<BankTransaction> builder)
    {
        builder.ToTable("bank_transactions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Date).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Reference).IsRequired().HasMaxLength(100);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.Balance).HasPrecision(18, 2);
        builder.Property(x => x.Type).IsRequired().HasMaxLength(10);
        builder.Property(x => x.Category).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Reconciled).HasDefaultValue(false);
    }
}
