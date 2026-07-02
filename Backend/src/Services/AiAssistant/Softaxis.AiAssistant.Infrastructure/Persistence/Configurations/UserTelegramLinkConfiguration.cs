using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class UserTelegramLinkConfiguration : IEntityTypeConfiguration<UserTelegramLink>
{
    public void Configure(EntityTypeBuilder<UserTelegramLink> builder)
    {
        builder.ToTable("user_telegram_links");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.UserName).HasMaxLength(200).IsRequired();
        builder.Property(x => x.LinkCode).HasMaxLength(40).IsRequired();
        builder.Property(x => x.TelegramUsername).HasMaxLength(100);
        builder.Property(x => x.IsLinked);
        builder.Property(x => x.CreatedAt);
        builder.Property(x => x.LinkedAt);

        builder.Property(x => x.PendingToolName).HasMaxLength(100);
        builder.Property(x => x.PendingArgumentsJson).HasMaxLength(4000);
        builder.Property(x => x.PendingSummary).HasMaxLength(2000);
        builder.Property(x => x.PendingCreatedAt);

        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.LinkCode);
        builder.HasIndex(x => x.TelegramChatId);
    }
}
