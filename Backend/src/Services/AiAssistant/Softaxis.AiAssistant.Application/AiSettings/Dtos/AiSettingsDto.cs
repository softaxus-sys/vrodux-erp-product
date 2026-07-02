namespace Softaxis.AiAssistant.Application.AiSettings.Dtos;

/// <summary>
/// Tenant AI configuration exposed to the admin UI. Secrets are NEVER returned — only the
/// <c>Has…</c> flags tell the UI whether a value is stored.
/// </summary>
public sealed record AiSettingsDto(
    string Provider,
    string? Model,
    bool Enabled,
    string Tier,
    bool VoiceEnabled,
    bool TelegramEnabled,
    bool HasApiKey,
    string? TelegramBotUsername = null,
    bool HasTelegramBotToken = false,
    string? TelegramInboundKey = null);
