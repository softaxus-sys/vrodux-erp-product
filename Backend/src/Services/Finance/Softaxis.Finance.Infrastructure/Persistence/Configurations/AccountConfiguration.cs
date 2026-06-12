using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.AccountNumber).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Name).IsRequired().HasMaxLength(200);
        builder.Property(x => x.AccountType).IsRequired().HasMaxLength(30);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3).HasDefaultValue("AED");
        builder.Property(x => x.Balance).HasPrecision(18, 2);
        builder.Property(x => x.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasIndex(x => x.AccountNumber).IsUnique();
        builder.HasIndex(x => x.AccountType);

        builder.HasMany(x => x.JournalLines)
               .WithOne(x => x.Account)
               .HasForeignKey(x => x.AccountId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<AccountType>()
               .WithMany()
               .HasForeignKey(x => x.AccountTypeId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
