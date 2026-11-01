namespace Softaxis.AiAssistant.Application.PlatformAi.Dtos;

/// <summary>The platform AI as the super admin sees it. Keys are never returned, only whether one is stored.</summary>
/// <param name="Ready">True when workspaces without their own key can actually be served right now.</param>
/// <param name="ReadyIssue">Plain-words reason it is not ready, when it is not.</param>
public sealed record PlatformAiDto(
    bool Enabled,
    string Provider,
    string? Model,
    bool HasApiKey,
    int MonthlyMessageCapPerTenant,
    int NudgeEveryMessages,
    bool ShowOwnKeyBanner,
    bool VoiceEnabled,
    string? SttModel,
    string? TtsModel,
    string? TtsVoice,
    int VoiceMonthlyCapPerTenant,
    bool HasVoiceApiKey,
    bool Ready,
    string? ReadyIssue,
    DateTime UpdatedAt);

public sealed record PlatformAiTestResultDto(bool Ok, string Message, int LatencyMs, string? Sample);

/// <summary>One workspace's use of the platform AI in one month.</summary>
public sealed record PlatformAiUsageRowDto(Guid TenantId, string TenantName, string Month, int Messages, int VoiceTurns);
