using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class JournalEntryConfiguration : IEntityTypeConfiguration<JournalEntry>
{
    public void Configure(EntityTypeBuilder<JournalEntry> builder)
    {
        builder.ToTable("journal_entries");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.EntryNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Date).IsRequired().HasMaxLength(20);
        builder.Property(x => x.Description).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Reference).HasMaxLength(100);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3).HasDefaultValue("AED");
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.CreatedByUserId).HasMaxLength(100);
        builder.Property(x => x.CreatedByName).HasMaxLength(200);

        // Computed properties — not mapped
        builder.Ignore(x => x.TotalDebit);
        builder.Ignore(x => x.TotalCredit);
        builder.Ignore(x => x.IsBalanced);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in FinanceDbContext (needs the TenantId shadow column).
        builder.HasIndex(x => x.Date);
        builder.HasIndex(x => x.Status);

        builder.HasMany(x => x.Lines)
               .WithOne(x => x.JournalEntry)
               .HasForeignKey(x => x.JournalEntryId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class JournalEntryLineConfiguration : IEntityTypeConfiguration<JournalEntryLine>
{
    public void Configure(EntityTypeBuilder<JournalEntryLine> builder)
    {
        builder.ToTable("journal_entry_lines");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.AccountName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.DebitAmount).HasPrecision(18, 2);
        builder.Property(x => x.CreditAmount).HasPrecision(18, 2);
        builder.Property(x => x.Description).HasMaxLength(500);

        builder.HasIndex(x => x.JournalEntryId);
        builder.HasIndex(x => x.AccountId);

        builder.HasOne(x => x.Account)
               .WithMany(x => x.JournalLines)
               .HasForeignKey(x => x.AccountId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
