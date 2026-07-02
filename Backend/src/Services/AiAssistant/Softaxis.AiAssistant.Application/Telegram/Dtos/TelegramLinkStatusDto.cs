namespace Softaxis.AiAssistant.Application.Telegram.Dtos;

/// <summary>
/// The current user's Telegram connection state. <see cref="DeepLink"/> is a t.me link that opens
/// the tenant bot pre-filled with the one-time <see cref="Code"/> to complete linking.
/// </summary>
public sealed record TelegramLinkStatusDto(
    bool BotConfigured,
    bool Linked,
    string? TelegramUsername,
    string? Code,
    string? DeepLink);
