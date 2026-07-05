namespace Softaxis.AiAssistant.Application.Voice.Dtos;

/// <summary>Tenant voice-agent configuration. The Vapi API key is write-only — only
/// <see cref="HasVapiApiKey"/> is exposed, never the key itself.</summary>
public sealed record VoiceSettingsDto(
    bool Enabled,
    bool HasVapiApiKey,
    string? VapiPhoneNumberId,
    string? VapiAssistantId,
    Guid RunAsUserId,
    int CallDelayMinutes,
    int MaxAttempts,
    int MonthlyMinutesCap,
    decimal MinutesUsedThisMonth,
    string DefaultLanguage,
    string? AgentName,
    string? CompanyName,
    string? CompanyDescription,
    string? Industry,
    string? Knowledge);

/// <summary>One outbound AI call to a lead, with its outcome once finished.</summary>
public sealed record ScheduledCallDto(
    Guid Id,
    Guid LeadId,
    string LeadName,
    string Phone,
    string Language,
    string Status,
    int AttemptCount,
    DateTime DueAt,
    string? EndedReason,
    int DurationSeconds,
    string? RecordingUrl,
    string? Summary,
    string? TranscriptText,
    string? Error,
    bool LeadUpdated,
    DateTime CreatedAt);
