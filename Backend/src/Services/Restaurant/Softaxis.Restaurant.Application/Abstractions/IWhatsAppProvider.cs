namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>Sends a receipt/notification over WhatsApp. Availability is per-tenant (see
/// NotificationProviderConfig) — a tenant with no Twilio credentials saved gets a log-only dev
/// fallback (same posture as the SMTP dev-fallback) and SendMessageAsync reports false so callers can
/// fall back to email.</summary>
public interface IWhatsAppProvider
{
    Task<bool> IsAvailableAsync(CancellationToken ct = default);
    Task<bool> SendMessageAsync(string toPhone, string message, CancellationToken ct = default);
}
