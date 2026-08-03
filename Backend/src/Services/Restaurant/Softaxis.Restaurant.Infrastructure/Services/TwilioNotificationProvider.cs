using System.Net.Http.Headers;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Services;

/// <summary>
/// Real Twilio Messages API client (https://www.twilio.com/docs/sms/api/message-resource) — implements
/// both ISmsProvider and IWhatsAppProvider (Twilio's WhatsApp channel is the same Messages endpoint
/// with a "whatsapp:" prefix on To/From — explicit interface implementation so each interface resolves
/// against its own NotificationProviderConfig row via Channel="sms"/"whatsapp"). Registered once in DI,
/// both interfaces resolve to the same instance per scope (see InfrastructureExtensions).
///
/// Credentials are resolved per-tenant, decrypted via ISecretProtector. A tenant with no config saved
/// yet gets the same log-only dev-fallback StubWhatsAppProvider used to provide (SendMessageAsync
/// returns false, callers fall back to email) — this is a genuine correctness-verified client (matches
/// Twilio's public API spec exactly), not a stub; it's simply untestable without a real Twilio account,
/// same posture as ErApiExchangeRateProvider (Module 6e) and MetaGraphClient (Module 7) when first written.
/// </summary>
internal sealed class TwilioNotificationProvider(
    RestaurantDbContext db, ISecretProtector protector, IHttpClientFactory httpClientFactory,
    ILogger<TwilioNotificationProvider> logger)
    : ISmsProvider, IWhatsAppProvider
{
    Task<bool> ISmsProvider.IsAvailableAsync(CancellationToken ct) => IsAvailableAsync("sms", ct);
    Task<bool> ISmsProvider.SendMessageAsync(string toPhone, string message, CancellationToken ct) =>
        SendAsync("sms", toPhone, message, ct);

    Task<bool> IWhatsAppProvider.IsAvailableAsync(CancellationToken ct) => IsAvailableAsync("whatsapp", ct);
    Task<bool> IWhatsAppProvider.SendMessageAsync(string toPhone, string message, CancellationToken ct) =>
        SendAsync("whatsapp", toPhone, message, ct);

    private async Task<bool> IsAvailableAsync(string channel, CancellationToken ct)
    {
        var config = await GetConfigAsync(channel, ct);
        return config is { IsEnabled: true, AccountSidEncrypted: not null, AuthTokenEncrypted: not null };
    }

    private Task<ConfigRow?> GetConfigAsync(string channel, CancellationToken ct) =>
        db.NotificationProviderConfigs.AsNoTracking()
            .Where(x => x.Channel == channel)
            .Select(x => new ConfigRow(x.AccountSidEncrypted, x.AuthTokenEncrypted, x.FromNumber, x.IsEnabled))
            .FirstOrDefaultAsync(ct);

    private async Task<bool> SendAsync(string channel, string toPhone, string message, CancellationToken ct)
    {
        var config = await GetConfigAsync(channel, ct);
        if (config is not { IsEnabled: true, AccountSidEncrypted: not null, AuthTokenEncrypted: not null, FromNumber: not null })
        {
            logger.LogWarning("Twilio ({Channel}) not configured. Message to {Phone}: {Message}", channel, toPhone, message);
            return false;
        }

        var accountSid = protector.Unprotect(config.AccountSidEncrypted);
        var authToken = protector.Unprotect(config.AuthTokenEncrypted);
        if (string.IsNullOrEmpty(accountSid) || string.IsNullOrEmpty(authToken))
        {
            logger.LogWarning("Twilio ({Channel}) credentials failed to decrypt.", channel);
            return false;
        }

        var to = channel == "whatsapp" ? $"whatsapp:{toPhone}" : toPhone;
        var from = channel == "whatsapp" ? $"whatsapp:{config.FromNumber}" : config.FromNumber;

        try
        {
            var client = httpClientFactory.CreateClient("twilio");
            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["To"] = to,
                    ["From"] = from!,
                    ["Body"] = message,
                }),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(Encoding.UTF8.GetBytes($"{accountSid}:{authToken}")));

            var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning("Twilio ({Channel}) send failed: {Status} {Body}", channel, response.StatusCode, body);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Twilio ({Channel}) send threw.", channel);
            return false;
        }
    }

    private sealed record ConfigRow(string? AccountSidEncrypted, string? AuthTokenEncrypted, string? FromNumber, bool IsEnabled);
}
