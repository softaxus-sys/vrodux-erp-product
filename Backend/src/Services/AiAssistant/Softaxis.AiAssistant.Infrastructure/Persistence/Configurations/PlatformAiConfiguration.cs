using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class PlatformAiSettingsConfiguration : IEntityTypeConfiguration<PlatformAiSettings>
{
    public void Configure(EntityTypeBuilder<PlatformAiSettings> builder)
    {
        builder.ToTable("platform_ai_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Provider).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(x => x.Model).HasMaxLength(160);
        builder.Property(x => x.ProtectedApiKey).HasColumnType("nvarchar(max)");
        builder.Property(x => x.ProtectedVoiceApiKey).HasColumnType("nvarchar(max)");
        builder.Property(x => x.SttModel).HasMaxLength(160);
        builder.Property(x => x.TtsModel).HasMaxLength(160);
        builder.Property(x => x.TtsVoice).HasMaxLength(60);
        builder.Ignore(x => x.HasApiKey);
        builder.Ignore(x => x.HasVoiceApiKey);
    }
}

public sealed class PlatformAiUsageConfiguration : IEntityTypeConfiguration<PlatformAiUsage>
{
    public void Configure(EntityTypeBuilder<PlatformAiUsage> builder)
    {
        builder.ToTable("platform_ai_usage");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Month).HasMaxLength(7).IsRequired();
        builder.HasIndex(x => x.Month);
    }
}
