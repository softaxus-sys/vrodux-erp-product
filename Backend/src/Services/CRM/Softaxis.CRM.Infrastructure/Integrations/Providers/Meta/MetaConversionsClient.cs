using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;

/// <summary>Outcome of one call to Meta. <see cref="Transient"/> = worth retrying on its own.</summary>
public sealed record MetaSendResult(bool Ok, int EventsReceived, string? Error, bool Transient)
{
    public static MetaSendResult Success(int received) => new(true, received, null, false);
    public static MetaSendResult Failure(string error, bool transient) => new(false, 0, error, transient);
}

/// <param name="Inconclusive">
/// Meta refused to READ the dataset because the token lacks that permission. The token Events Manager
/// generates for the Conversions API is allowed to send events but not to read the dataset, so this is the
/// normal result for the right kind of token — it says nothing about whether sending will work.
/// </param>
public sealed record MetaDatasetCheck(bool Ok, string? Name, string? Error, bool Inconclusive = false);

/// <summary>
/// Conversions API client: posts lead-stage events to a tenant's Meta dataset, and checks a dataset/token pair.
/// The token travels in the Authorization header, never in the URL, so it cannot end up in a request log.
/// </summary>
public sealed class MetaConversionsClient(
    IHttpClientFactory httpFactory, IOptions<MetaOptions> options, ILogger<MetaConversionsClient> logger)
{
    private string Base => $"https://graph.facebook.com/{options.Value.ConversionsGraphVersion}";

    /// <summary>Confirms the dataset exists and the token can see it. Returns the dataset's name for the screen.</summary>
    public async Task<MetaDatasetCheck> VerifyAsync(string datasetId, string token, CancellationToken ct)
    {
        try
        {
            var client = httpFactory.CreateClient("meta");
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{Base}/{Uri.EscapeDataString(datasetId)}?fields=id,name");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var resp = await client.SendAsync(req, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
            {
                // A permission refusal (not an invalid/expired token, which is code 190) on a READ does not
                // mean the token cannot SEND — see MetaDatasetCheck.Inconclusive.
                var inconclusive = ErrorCode(body) is 100 or 200 or 10 or 283
                    && body.Contains("permission", StringComparison.OrdinalIgnoreCase);
                return new MetaDatasetCheck(false, null, Explain(body, (int)resp.StatusCode), inconclusive);
            }

            var root = JsonDocument.Parse(body).RootElement;
            return new MetaDatasetCheck(true, root.TryGetProperty("name", out var n) ? n.GetString() : null, null);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Meta dataset check failed for {Dataset}.", datasetId);
            return new MetaDatasetCheck(false, null, "Could not reach Meta. Check your connection and try again.");
        }
    }

    /// <summary>
    /// Sends up to 1,000 events in one request. <paramref name="testEventCode"/> routes them to the
    /// "Test events" tab in Events Manager instead of the live dataset.
    /// </summary>
    public async Task<MetaSendResult> SendAsync(
        string datasetId, string token, IReadOnlyList<JsonObject> events, string? testEventCode, CancellationToken ct)
    {
        var payload = new JsonObject { ["data"] = new JsonArray(events.Select(e => (JsonNode?)e).ToArray()) };
        if (!string.IsNullOrWhiteSpace(testEventCode)) payload["test_event_code"] = testEventCode.Trim();

        try
        {
            var client = httpFactory.CreateClient("meta");
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/{Uri.EscapeDataString(datasetId)}/events")
            {
                Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json"),
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var resp = await client.SendAsync(req, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (resp.IsSuccessStatusCode)
            {
                var received = 0;
                try { received = JsonDocument.Parse(body).RootElement.TryGetProperty("events_received", out var r) ? r.GetInt32() : events.Count; }
                catch { received = events.Count; }
                return MetaSendResult.Success(received);
            }

            var status = (int)resp.StatusCode;
            logger.LogWarning("Meta Conversions API {Status} for dataset {Dataset}: {Body}", status, datasetId, Trim(body));
            return MetaSendResult.Failure(Explain(body, status), IsTransient(body, status));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Network trouble, a timeout, a dropped connection: nothing about the events themselves is wrong.
            logger.LogWarning(ex, "Meta Conversions API unreachable for dataset {Dataset}.", datasetId);
            return MetaSendResult.Failure("Could not reach Meta.", transient: true);
        }
    }

    // Meta's own "try again later" signals: rate limits and temporary errors. Everything else — a bad
    // token, a dataset the token cannot write to, a malformed event — will fail the same way next time.
    private static bool IsTransient(string body, int status)
    {
        if (status is 429 or >= 500) return true;
        var code = ErrorCode(body);
        return code is 1 or 2 or 4 or 17 or 32 or 341 or 613;
    }

    private static int? ErrorCode(string body)
    {
        try
        {
            return JsonDocument.Parse(body).RootElement.GetProperty("error").TryGetProperty("code", out var c) && c.TryGetInt32(out var i) ? i : null;
        }
        catch { return null; }
    }

    /// <summary>The message Meta gave, with the common causes turned into something a person can act on.</summary>
    private static string Explain(string body, int status)
    {
        string? message = null; int? code = null; int? sub = null;
        try
        {
            var err = JsonDocument.Parse(body).RootElement.GetProperty("error");
            message = err.TryGetProperty("message", out var m) ? m.GetString() : null;
            code = err.TryGetProperty("code", out var c) && c.TryGetInt32(out var ci) ? ci : null;
            sub  = err.TryGetProperty("error_subcode", out var s) && s.TryGetInt32(out var si) ? si : null;
        }
        catch { /* not JSON — fall through to the status code */ }

        var hint = (code, sub) switch
        {
            (190, _) => "The access token is invalid or has expired. Generate a new one in Events Manager and paste it in.",
            (200, _) or (10, _) or (283, _) => "This token is not allowed to send events to that dataset. Generate the token from the same dataset in Events Manager.",
            (100, _) when message?.Contains("permission", StringComparison.OrdinalIgnoreCase) == true
                => "This token is not allowed to do that on this dataset. Use the token from Events Manager → your dataset → "
                   + "Settings → Conversions API → Generate access token (not one from Graph API Explorer), "
                   + "and make sure you are an admin of the dataset.",
            (100, _) when message?.Contains("does not exist", StringComparison.OrdinalIgnoreCase) == true
                => "Meta could not find that dataset. Check the Dataset ID.",
            _ => null,
        };

        if (hint is not null) return message is null ? hint : $"{hint} (Meta said: {Trim(message)})";
        return message is not null ? $"Meta rejected the request: {Trim(message)}" : $"Meta returned HTTP {status}.";
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] + "…" : s;
}
