using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence.Configurations;

public sealed class CreditReminderSettingsConfiguration : IEntityTypeConfiguration<CreditReminderSettings>
{
    public void Configure(EntityTypeBuilder<CreditReminderSettings> b)
    {
        b.ToTable("credit_reminder_settings");
        b.HasKey(x => x.Id);
        b.Property(x => x.SenderName).HasMaxLength(100);
        b.Property(x => x.CcEmail).HasMaxLength(200);
        b.Property(x => x.TimeZoneId).HasMaxLength(64);
        b.Property(x => x.LastDailyRunOn).HasMaxLength(10);
    }
}

public sealed class CreditReminderLogConfiguration : IEntityTypeConfiguration<CreditReminderLog>
{
    public void Configure(EntityTypeBuilder<CreditReminderLog> b)
    {
        b.ToTable("credit_reminder_logs");
        b.HasKey(x => x.Id);
        b.Property(x => x.CustomerName).HasMaxLength(200);
        b.Property(x => x.Email).HasMaxLength(320);
        b.Property(x => x.Kind).HasMaxLength(12);
        b.Property(x => x.Status).HasMaxLength(10);
        b.Property(x => x.Key).HasMaxLength(80);
        b.Property(x => x.Error).HasMaxLength(300);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.HasIndex(x => x.CustomerId);
        // The same reminder can be claimed once. Customer ids are globally unique, so the key needs no tenant column.
        b.HasIndex(x => x.Key).IsUnique().HasFilter("[Key] IS NOT NULL");
    }
}
