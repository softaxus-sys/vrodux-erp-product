using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.PushNotifications;

namespace Softaxis.BuildingBlocks.Infrastructure.PushNotifications;

/// <summary>
/// Posts to Expo's push API (<c>https://exp.host/--/api/v2/push/send</c>) — the standard way an
/// Expo-built app receives push without either side touching APNs/FCM directly. Batches at Expo's
/// own 100-messages-per-request cap. Read-as-string + JsonDocument (mirrors
/// <c>ErApiExchangeRateProvider</c>) to avoid a model per response shape.
/// </summary>
public sealed class ExpoPushNotificationSender(
    IHttpClientFactory httpFactory,
    ILogger<ExpoPushNotificationSender> logger) : IPushNotificationSender
{
    private const string Endpoint = "https://exp.host/--/api/v2/push/send";
    private const int BatchSize = 100;

    public async Task<IReadOnlyList<string>> SendAsync(
        IReadOnlyList<string> expoPushTokens,
        string title,
        string body,
        IReadOnlyDictionary<string, string>? data = null,
        CancellationToken ct = default)
    {
        var tokens = expoPushTokens.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().ToList();
        if (tokens.Count == 0) return [];

        var dead = new List<string>();
        var client = httpFactory.CreateClient("expo-push");
        client.Timeout = TimeSpan.FromSeconds(15);

        for (var offset = 0; offset < tokens.Count; offset += BatchSize)
        {
            var batch = tokens.Skip(offset).Take(BatchSize).ToList();
            var messages = batch.Select(t => new ExpoMessage(t, title, body, "default", data)).ToList();

            try
            {
                var json = JsonSerializer.Serialize(messages, JsonOptions);
                using var content = new StringContent(json, Encoding.UTF8);
                content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
                using var resp = await client.PostAsync(Endpoint, content, ct);
                await using var stream = await resp.Content.ReadAsStreamAsync(ct);
                using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

                if (!doc.RootElement.TryGetProperty("data", out var results) || results.ValueKind != JsonValueKind.Array)
                {
                    logger.LogWarning("Expo push: unexpected response shape for a batch of {Count}.", batch.Count);
                    continue;
                }

                var i = 0;
                foreach (var ticket in results.EnumerateArray())
                {
                    if (i >= batch.Count) break;
                    var status = ticket.TryGetProperty("status", out var s) ? s.GetString() : null;
                    if (status == "error")
                    {
                        var errorCode = ticket.TryGetProperty("details", out var det) && det.TryGetProperty("error", out var e)
                            ? e.GetString() : null;
                        if (errorCode == "DeviceNotRegistered")
                            dead.Add(batch[i]);
                        else
                            logger.LogInformation("Expo push: ticket error {Error} for a token.", errorCode ?? "unknown");
                    }
                    i++;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Expo push: batch of {Count} failed to send.", batch.Count);
            }
        }

        return dead;
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private sealed record ExpoMessage(
        string To, string Title, string Body, string Sound,
        [property: JsonPropertyName("data")] IReadOnlyDictionary<string, string>? Data);
}
