namespace Softaxis.AiAssistant.Application.AiSettings.Dtos;

/// <summary>
/// Tenant AI configuration exposed to the admin UI. The API key is NEVER returned — only
/// <see cref="HasApiKey"/> tells the UI whether one is stored.
/// </summary>
public sealed record AiSettingsDto(
    string Provider,
    string? Model,
    bool Enabled,
    string Tier,
    bool VoiceEnabled,
    bool TelegramEnabled,
    bool HasApiKey);
