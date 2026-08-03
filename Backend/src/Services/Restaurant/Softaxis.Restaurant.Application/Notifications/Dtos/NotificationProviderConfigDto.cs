namespace Softaxis.Restaurant.Application.Notifications.Dtos;

/// <summary>Never carries the decrypted secret — HasAccountSid/HasAuthToken are booleans so the
/// settings UI can show "configured" without round-tripping the actual credentials to the browser.</summary>
public sealed record NotificationProviderConfigDto(
    string Channel, string Provider, bool HasAccountSid, bool HasAuthToken, string? FromNumber, bool IsEnabled);
