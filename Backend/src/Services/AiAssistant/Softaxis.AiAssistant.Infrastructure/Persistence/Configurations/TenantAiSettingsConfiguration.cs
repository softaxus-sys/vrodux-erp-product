using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class TenantAiSettingsConfiguration : IEntityTypeConfiguration<TenantAiSettings>
{
    public void Configure(EntityTypeBuilder<TenantAiSettings> builder)
    {
        builder.ToTable("tenant_ai_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Provider).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(x => x.ProtectedApiKey).HasColumnType("nvarchar(max)");
        builder.Property(x => x.Model).HasMaxLength(120);
        builder.Property(x => x.Tier).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Enabled);
        builder.Property(x => x.VoiceEnabled);
        builder.Property(x => x.TelegramEnabled);
        builder.Property(x => x.CreatedAt);
        builder.Property(x => x.UpdatedAt);

        builder.Property(x => x.FallbackProvider).HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.FallbackProtectedApiKey).HasColumnType("nvarchar(max)");
        builder.Property(x => x.FallbackModel).HasMaxLength(120);

        builder.Ignore(x => x.HasApiKey);
        builder.Ignore(x => x.HasFallbackApiKey);
        builder.Ignore(x => x.FallbackConfigured);
    }
}
