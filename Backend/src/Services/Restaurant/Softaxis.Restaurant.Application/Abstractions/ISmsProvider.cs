namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>Sends a receipt/notification over SMS. Mirrors IWhatsAppProvider exactly — both channels
/// resolve their tenant's Twilio credentials (see NotificationProviderConfig) the same way.</summary>
public interface ISmsProvider
{
    Task<bool> IsAvailableAsync(CancellationToken ct = default);
    Task<bool> SendMessageAsync(string toPhone, string message, CancellationToken ct = default);
}
