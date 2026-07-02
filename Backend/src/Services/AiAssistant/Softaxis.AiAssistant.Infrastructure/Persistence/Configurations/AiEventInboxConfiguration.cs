using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class AiEventInboxConfiguration : IEntityTypeConfiguration<AiEventInbox>
{
    public void Configure(EntityTypeBuilder<AiEventInbox> builder)
    {
        builder.ToTable("event_inbox");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.EventKey).HasMaxLength(80).IsRequired();
        builder.Property(x => x.EntityId);
        builder.Property(x => x.Title).HasMaxLength(400);
        builder.Property(x => x.PayloadJson).HasMaxLength(4000);

        builder.Property(x => x.Status).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Attempts);
        builder.Property(x => x.NextAttemptAt);
        builder.Property(x => x.Error).HasMaxLength(1000);
        builder.Property(x => x.RulesFired);

        builder.Property(x => x.ReceivedAt);
        builder.Property(x => x.ProcessedAt);
        builder.Property(x => x.CreatedAt);

        // The processor polls on (Status, NextAttemptAt) across all tenants.
        builder.HasIndex(x => new { x.Status, x.NextAttemptAt });
        builder.HasIndex(x => x.EventKey);
    }
}
