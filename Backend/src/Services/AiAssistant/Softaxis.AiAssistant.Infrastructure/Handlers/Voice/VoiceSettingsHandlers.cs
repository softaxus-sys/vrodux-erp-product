using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Voice.Commands;
using Softaxis.AiAssistant.Application.Voice.Dtos;
using Softaxis.AiAssistant.Application.Voice.Queries;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Voice;

internal sealed class GetVoiceSettingsHandler(AiAssistantDbContext db)
    : IQueryHandler<GetVoiceSettingsQuery, VoiceSettingsDto>
{
    public async Task<Result<VoiceSettingsDto>> Handle(GetVoiceSettingsQuery request, CancellationToken ct)
    {
        var s = await db.VoiceSettings.AsNoTracking().FirstOrDefaultAsync(ct);

        if (s is null)
            return new VoiceSettingsDto(
                Enabled: false, HasVapiApiKey: false, VapiPhoneNumberId: null, VapiAssistantId: null,
                RunAsUserId: Guid.Empty,
                CallDelayMinutes: 5, MaxAttempts: 3, MonthlyMinutesCap: 0, MinutesUsedThisMonth: 0,
                DefaultLanguage: "en", AgentName: null, CompanyName: null, CompanyDescription: null,
                Industry: null, Knowledge: null);

        return VoiceMappings.ToDto(s);
    }
}

internal sealed class UpdateVoiceSettingsHandler(AiAssistantDbContext db, ISecretProtector protector)
    : ICommandHandler<UpdateVoiceSettingsCommand, VoiceSettingsDto>
{
    public async Task<Result<VoiceSettingsDto>> Handle(UpdateVoiceSettingsCommand cmd, CancellationToken ct)
    {
        var settings = await db.VoiceSettings.FirstOrDefaultAsync(ct);
        if (settings is null)
        {
            settings = new TenantVoiceSettings(cmd.RunAsUserId);
            db.VoiceSettings.Add(settings);
        }

        settings.Configure(
            cmd.Enabled, cmd.VapiPhoneNumberId, cmd.VapiAssistantId, cmd.RunAsUserId,
            cmd.CallDelayMinutes, cmd.MaxAttempts, cmd.MonthlyMinutesCap, cmd.DefaultLanguage,
            cmd.AgentName, cmd.CompanyName, cmd.CompanyDescription, cmd.Industry, cmd.Knowledge);

        if (cmd.ClearVapiApiKey)
            settings.ClearVapiApiKey();
        else if (!string.IsNullOrWhiteSpace(cmd.VapiApiKey))
            settings.SetProtectedVapiApiKey(protector.Protect(cmd.VapiApiKey.Trim()));

        if (cmd.Enabled && !settings.HasVapiApiKey)
            return Result.Failure<VoiceSettingsDto>(Error.Custom(
                "Voice.MissingApiKey", "A Vapi API key is required to enable the voice agent."));

        await db.SaveChangesAsync(ct);
        return VoiceMappings.ToDto(settings);
    }
}

internal sealed class GetScheduledCallsHandler(AiAssistantDbContext db)
    : IQueryHandler<GetScheduledCallsQuery, IReadOnlyList<ScheduledCallDto>>
{
    public async Task<Result<IReadOnlyList<ScheduledCallDto>>> Handle(GetScheduledCallsQuery q, CancellationToken ct)
    {
        var rows = await db.ScheduledCalls.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Take(Math.Clamp(q.Take, 1, 200))
            .ToListAsync(ct);

        return rows.Select(VoiceMappings.ToDto).ToList();
    }
}

internal static class VoiceMappings
{
    public static VoiceSettingsDto ToDto(TenantVoiceSettings s) => new(
        s.Enabled, s.HasVapiApiKey, s.VapiPhoneNumberId, s.VapiAssistantId, s.RunAsUserId,
        s.CallDelayMinutes, s.MaxAttempts, s.MonthlyMinutesCap, s.MinutesUsedThisMonth,
        s.DefaultLanguage, s.AgentName, s.CompanyName, s.CompanyDescription, s.Industry, s.Knowledge);

    public static ScheduledCallDto ToDto(ScheduledCall c) => new(
        c.Id, c.LeadId, c.LeadName, c.Phone, c.Language, c.Status, c.AttemptCount, c.DueAt,
        c.EndedReason, c.DurationSeconds, c.RecordingUrl, c.Summary, c.TranscriptText,
        c.Error, c.LeadUpdated, c.CreatedAt);
}
