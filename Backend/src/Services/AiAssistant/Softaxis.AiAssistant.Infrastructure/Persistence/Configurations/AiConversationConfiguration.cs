using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class AiConversationConfiguration : IEntityTypeConfiguration<AiConversation>
{
    public void Configure(EntityTypeBuilder<AiConversation> builder)
    {
        builder.ToTable("ai_conversations");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.CreatedAt);
        builder.Property(x => x.UpdatedAt);

        builder.HasIndex(x => x.UserId);

        builder.HasMany(x => x.Messages)
               .WithOne()
               .HasForeignKey(x => x.ConversationId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class AiConversationMessageConfiguration : IEntityTypeConfiguration<AiConversationMessage>
{
    public void Configure(EntityTypeBuilder<AiConversationMessage> builder)
    {
        builder.ToTable("ai_chat_messages");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.ConversationId).IsRequired();
        builder.Property(x => x.Role).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Content).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(x => x.CreatedAt);
        builder.Property(x => x.UsedFallback).IsRequired().HasDefaultValue(false);

        builder.HasIndex(x => x.ConversationId);
    }
}
