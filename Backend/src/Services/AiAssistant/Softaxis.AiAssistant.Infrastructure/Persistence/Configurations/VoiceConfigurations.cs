using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.AiAssistant.Domain.Entities;

namespace Softaxis.AiAssistant.Infrastructure.Persistence.Configurations;

public sealed class TenantVoiceSettingsConfiguration : IEntityTypeConfiguration<TenantVoiceSettings>
{
    public void Configure(EntityTypeBuilder<TenantVoiceSettings> builder)
    {
        builder.ToTable("tenant_voice_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.ProtectedVapiApiKey).HasColumnType("nvarchar(max)");
        builder.Property(x => x.VapiPhoneNumberId).HasMaxLength(100);
        builder.Property(x => x.VapiAssistantId).HasMaxLength(100);
        builder.Property(x => x.InboundKey).HasMaxLength(64).IsRequired();
        builder.Property(x => x.WebhookSecret).HasMaxLength(64).IsRequired();
        builder.Property(x => x.DefaultLanguage).HasMaxLength(10).IsRequired();
        builder.Property(x => x.UsageMonth).HasMaxLength(7);
        builder.Property(x => x.MinutesUsedThisMonth).HasColumnType("decimal(12,2)");
        builder.Property(x => x.AgentName).HasMaxLength(120);
        builder.Property(x => x.CompanyName).HasMaxLength(200);
        builder.Property(x => x.CompanyDescription).HasMaxLength(2000);
        builder.Property(x => x.Industry).HasMaxLength(120);
        builder.Property(x => x.Knowledge).HasColumnType("nvarchar(max)");

        // The anonymous webhook resolves the tenant by this key.
        builder.HasIndex(x => x.InboundKey).IsUnique();

        builder.Ignore(x => x.HasVapiApiKey);
    }
}

public sealed class ScheduledCallConfiguration : IEntityTypeConfiguration<ScheduledCall>
{
    public void Configure(EntityTypeBuilder<ScheduledCall> builder)
    {
        builder.ToTable("scheduled_calls");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.LeadName).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Phone).HasMaxLength(40).IsRequired();
        builder.Property(x => x.Language).HasMaxLength(10).IsRequired();
        builder.Property(x => x.LeadContext).HasMaxLength(4000);
        builder.Property(x => x.Status).HasMaxLength(20).IsRequired();
        builder.Property(x => x.VapiCallId).HasMaxLength(100);
        builder.Property(x => x.EndedReason).HasMaxLength(200);
        builder.Property(x => x.TranscriptText).HasColumnType("nvarchar(max)");
        builder.Property(x => x.RecordingUrl).HasMaxLength(1000);
        builder.Property(x => x.Summary).HasColumnType("nvarchar(max)");
        builder.Property(x => x.Error).HasMaxLength(1000);

        builder.HasMany(x => x.Attempts)
            .WithOne()
            .HasForeignKey(x => x.ScheduledCallId)
            .OnDelete(DeleteBehavior.Cascade);

        // Worker scan (due pending calls) + webhook lookup + one-call-per-lead dedupe.
        builder.HasIndex(x => new { x.Status, x.DueAt });
        builder.HasIndex(x => x.VapiCallId);
        builder.HasIndex(x => x.LeadId);
    }
}

public sealed class CallAttemptConfiguration : IEntityTypeConfiguration<CallAttempt>
{
    public void Configure(EntityTypeBuilder<CallAttempt> builder)
    {
        builder.ToTable("call_attempts");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.VapiCallId).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Outcome).HasMaxLength(20);
        builder.Property(x => x.Error).HasMaxLength(1000);
    }
}
