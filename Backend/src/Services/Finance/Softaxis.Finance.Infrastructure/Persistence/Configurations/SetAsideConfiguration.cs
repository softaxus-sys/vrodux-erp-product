using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class SetAsideRuleConfiguration : IEntityTypeConfiguration<SetAsideRule>
{
    public void Configure(EntityTypeBuilder<SetAsideRule> b)
    {
        b.ToTable("set_aside_rules");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.Kind).IsRequired().HasMaxLength(10);
        b.Property(x => x.Value).HasPrecision(18, 4);
    }
}

internal sealed class SetAsideEntryConfiguration : IEntityTypeConfiguration<SetAsideEntry>
{
    public void Configure(EntityTypeBuilder<SetAsideEntry> b)
    {
        b.ToTable("set_aside_entries");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.SourceKey).IsRequired().HasMaxLength(60);
        b.Property(x => x.InvoiceNumber).IsRequired().HasMaxLength(50);
        b.Property(x => x.Name).IsRequired().HasMaxLength(100);
        b.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3);
        b.Property(x => x.AccruedOn).IsRequired().HasMaxLength(10);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.LedgerAmount).HasPrecision(18, 2);
        b.Property(x => x.BaseLedgerAmount).HasPrecision(18, 2);
        b.Ignore(x => x.IsPaid);
        b.HasIndex(x => x.InvoiceId);
        b.HasIndex(x => x.SourceKey);
        b.HasIndex(x => x.PayoutId);
    }
}

internal sealed class SetAsidePayoutConfiguration : IEntityTypeConfiguration<SetAsidePayout>
{
    public void Configure(EntityTypeBuilder<SetAsidePayout> b)
    {
        b.ToTable("set_aside_payouts");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.PaidOn).IsRequired().HasMaxLength(10);
        b.Property(x => x.FromAccountNumber).IsRequired().HasMaxLength(30);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.Reference).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(500);
    }
}

internal sealed class SetAsideStateConfiguration : IEntityTypeConfiguration<SetAsideState>
{
    public void Configure(EntityTypeBuilder<SetAsideState> b)
    {
        b.ToTable("set_aside_state");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.LastReminderMonth).HasMaxLength(7);
    }
}
