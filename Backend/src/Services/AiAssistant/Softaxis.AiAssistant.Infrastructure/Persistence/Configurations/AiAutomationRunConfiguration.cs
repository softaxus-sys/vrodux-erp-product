using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class AiAutomationRunConfiguration : IEntityTypeConfiguration<AiAutomationRun>
{
    public void Configure(EntityTypeBuilder<AiAutomationRun> builder)
    {
        builder.ToTable("automation_runs");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.RuleId).IsRequired();
        builder.Property(x => x.RuleName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.RunAsUserId).IsRequired();
        builder.Property(x => x.TriggeredBy).HasMaxLength(20).IsRequired();

        builder.Property(x => x.Status).HasMaxLength(30).IsRequired();
        builder.Property(x => x.Summary).HasMaxLength(4000);
        builder.Property(x => x.ToolsUsed).HasMaxLength(1000);
        builder.Property(x => x.Error).HasMaxLength(1000);

        builder.Property(x => x.PendingToolName).HasMaxLength(100);
        builder.Property(x => x.PendingArgumentsJson).HasMaxLength(4000);

        builder.Property(x => x.StartedAt);
        builder.Property(x => x.CompletedAt);
        builder.Property(x => x.CreatedAt);

        builder.HasIndex(x => new { x.RuleId, x.StartedAt });
        builder.HasIndex(x => x.Status);
    }
}
