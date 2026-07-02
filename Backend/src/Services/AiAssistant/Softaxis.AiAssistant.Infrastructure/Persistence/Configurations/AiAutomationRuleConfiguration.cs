using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class AiAutomationRuleConfiguration : IEntityTypeConfiguration<AiAutomationRule>
{
    public void Configure(EntityTypeBuilder<AiAutomationRule> builder)
    {
        builder.ToTable("automation_rules");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.Property(x => x.Agent).HasMaxLength(40);
        builder.Property(x => x.Instruction).HasMaxLength(4000).IsRequired();

        builder.Property(x => x.RunAsUserId).IsRequired();
        builder.Property(x => x.RunAsUserName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Mode).HasMaxLength(20).IsRequired();

        builder.Property(x => x.TriggerType).HasMaxLength(20).IsRequired().HasDefaultValue("schedule");
        builder.Property(x => x.EventKey).HasMaxLength(80);

        builder.Property(x => x.Frequency).HasConversion<int>();
        builder.Property(x => x.IntervalMinutes);
        builder.Property(x => x.HourUtc);
        builder.Property(x => x.MinuteUtc);
        builder.Property(x => x.DayOfWeekUtc);

        builder.Property(x => x.NotifyTelegram);
        builder.Property(x => x.Enabled);

        builder.Property(x => x.LastRunAt);
        builder.Property(x => x.NextRunAt);
        builder.Property(x => x.LastStatus).HasMaxLength(30);
        builder.Property(x => x.LastError).HasMaxLength(1000);
        builder.Property(x => x.RunCount);

        builder.Property(x => x.CreatedAt);
        builder.Property(x => x.UpdatedAt);

        // The scheduler polls on (Enabled, NextRunAt) across all tenants.
        builder.HasIndex(x => new { x.Enabled, x.NextRunAt });
        // The event processor looks rules up by (Enabled, EventKey).
        builder.HasIndex(x => new { x.Enabled, x.EventKey });
    }
}
