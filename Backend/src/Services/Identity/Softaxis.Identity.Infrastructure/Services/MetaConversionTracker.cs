using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Meta Conversions API. Config: <c>MetaConversions:PixelId</c> + <c>MetaConversions:AccessToken</c>
/// (env <c>MetaConversions__AccessToken</c> — a secret, never in appsettings). Either missing = off.
/// Optional <c>MetaConversions:TestEventCode</c> routes events to Events Manager's Test Events tab.
/// </summary>
internal sealed class MetaConversionTracker(
    IHttpClientFactory http,
    IConfiguration config,
    ILogger<MetaConversionTracker> logger) : IConversionTracker
{
    public const string HttpClientName = "meta-conversions";

    public async Task TrackTrialStartedAsync(TrialConversion c, CancellationToken ct)
    {
        var pixelId = config["MetaConversions:PixelId"];
        var token   = config["MetaConversions:AccessToken"];
        if (string.IsNullOrWhiteSpace(pixelId) || string.IsNullOrWhiteSpace(token)) return;

        try
        {
            var userData = new Dictionary<string, object?>
            {
                ["em"]                = new[] { Hash(c.Email) },
                ["client_ip_address"] = c.ClientIp,
                ["client_user_agent"] = c.UserAgent,
                ["fbp"]               = c.Fbp,
                ["fbc"]               = c.Fbc,
            };
            var first = c.FullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
            if (first.Length > 0) userData["fn"] = new[] { Hash(first[0]) };
            if (first.Length > 1) userData["ln"] = new[] { Hash(first[1]) };
            if (!string.IsNullOrWhiteSpace(c.Country)) userData["country"] = new[] { Hash(c.Country!) };

            var body = new Dictionary<string, object?>
            {
                ["data"] = new[]
                {
                    new Dictionary<string, object?>
                    {
                        ["event_name"]       = "StartTrial",
                        ["event_time"]       = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                        ["event_id"]         = c.EventId,
                        ["action_source"]    = "website",
                        ["event_source_url"] = c.SourceUrl,
                        ["user_data"]        = userData,
                        ["custom_data"]      = new { plan = c.Plan },
                    }
                },
                ["test_event_code"] = config["MetaConversions:TestEventCode"],
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));
            var client = http.CreateClient(HttpClientName);
            var res = await client.PostAsJsonAsync(
                $"https://graph.facebook.com/v21.0/{pixelId}/events?access_token={Uri.EscapeDataString(token)}",
                body, cts.Token);
            if (!res.IsSuccessStatusCode)
                logger.LogWarning("Meta CAPI StartTrial rejected: {Status}", (int)res.StatusCode);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Meta CAPI StartTrial failed (signup unaffected)");
        }
    }

    // Meta requires lower-cased, trimmed SHA-256 hex.
    private static string Hash(string v) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(v.Trim().ToLowerInvariant()))).ToLowerInvariant();
}
