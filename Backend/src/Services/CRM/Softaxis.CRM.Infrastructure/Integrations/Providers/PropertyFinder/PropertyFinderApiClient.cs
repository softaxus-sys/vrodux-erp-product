using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;

/// <summary>
/// Property Finder Enterprise API client (https://atlas.propertyfinder.com).
///
/// Three things about this API drive the design:
///
///  1. <b>Auth is a short-lived JWT.</b> <c>POST /v1/auth/token</c> exchanges the apiKey/apiSecret
///     pair for a token valid ~30 minutes. That endpoint is rate limited to 60 req/min — far
///     tighter than the 650 req/min on everything else — so the token is cached per API key and
///     reused until shortly before expiry. Re-authenticating per call would exhaust the limit
///     during a backfill.
///
///  2. <b>429 is expected under sustained paging</b> and the documented remedy is incremental
///     backoff with jitter, so every request retries on 429 (and on 5xx, which the docs list for
///     upstream hiccups).
///
///  3. <b>Keys expire — 365 days maximum</b> and then hard-invalidate. A 401 after a successful
///     auth is therefore meaningful: it usually means the key was revoked or expired, not a
///     transient fault. It surfaces as <see cref="PropertyFinderAuthException"/> so the caller can
///     mark the integration unhealthy instead of retrying forever.
/// </summary>
public sealed class PropertyFinderApiClient(
    IHttpClientFactory httpFactory,
    IOptions<PropertyFinderOptions> options,
    ILogger<PropertyFinderApiClient> logger)
{
    private readonly PropertyFinderOptions _o = options.Value;

    private sealed record CachedToken(string Token, DateTime ExpiresAt);
    private static readonly ConcurrentDictionary<string, CachedToken> Tokens = new();

    /// <summary>API credentials for one Property Finder account.</summary>
    public sealed record Credentials(string ApiKey, string ApiSecret);

    /// <summary>
    /// Builds a credential pair from an explicit key/secret.
    ///
    /// <para>There is deliberately <b>no fallback to configuration</b>. A Property Finder account
    /// belongs to one agency, so a shared configuration key would be used by every tenant on the
    /// deployment — one agency's import would pull another agency's agents and enquiries into their
    /// CRM. Credentials come from the calling tenant's own integration; see
    /// <see cref="PropertyFinderCredentialStore"/>.</para>
    /// </summary>
    public static Credentials? BuildCredentials(string? apiKey, string? apiSecret) =>
        string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(apiSecret)
            ? null
            : new Credentials(apiKey.Trim(), apiSecret.Trim());

    // ── Auth ────────────────────────────────────────────────────────────────────

    private async Task<string> GetTokenAsync(Credentials cred, CancellationToken ct)
    {
        // 60s of headroom: a token that expires mid-request would fail the call, not renew it.
        if (Tokens.TryGetValue(cred.ApiKey, out var cached) && DateTime.UtcNow < cached.ExpiresAt.AddSeconds(-60))
            return cached.Token;

        var http = httpFactory.CreateClient("property-finder");
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_o.BaseUrl}/v1/auth/token")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new { apiKey = cred.ApiKey, apiSecret = cred.ApiSecret }),
                Encoding.UTF8, "application/json"),
        };

        using var res = await http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            // An HTML body means the CDN in front of the API rejected us, not the API itself —
            // most often a missing User-Agent. Saying "authentication failed" there sends people
            // to regenerate a perfectly good key.
            if (body.TrimStart().StartsWith("<", StringComparison.Ordinal))
                throw new PropertyFinderApiException(
                    $"Property Finder's CDN blocked the request ({(int)res.StatusCode}) before it reached the API. " +
                    "This is a network/edge rejection, not a bad API key.");

            throw new PropertyFinderAuthException($"Property Finder authentication failed ({(int)res.StatusCode}). {Trim(body)}");
        }

        var root = JsonDocument.Parse(body).RootElement;
        var token = root.GetProperty("accessToken").GetString()
                    ?? throw new PropertyFinderAuthException("Property Finder returned no access token.");
        var seconds = root.TryGetProperty("expiresIn", out var e) && e.TryGetInt32(out var s) ? s : 1800;

        Tokens[cred.ApiKey] = new CachedToken(token, DateTime.UtcNow.AddSeconds(seconds));
        return token;
    }

    // ── Core request ────────────────────────────────────────────────────────────

    private async Task<JsonElement> GetAsync(string path, Credentials cred, CancellationToken ct)
    {
        const int maxAttempts = 5;
        for (var attempt = 1; ; attempt++)
        {
            var token = await GetTokenAsync(cred, ct);
            var http  = httpFactory.CreateClient("property-finder");
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{_o.BaseUrl}{path}");
            req.Headers.Add("Authorization", $"Bearer {token}");

            using var res = await http.SendAsync(req, ct);

            // A 401 on the very first attempt can be a token that was revoked server-side while
            // still inside its local lifetime — drop the cache and try once more before giving up.
            if (res.StatusCode == HttpStatusCode.Unauthorized && attempt == 1)
            {
                Tokens.TryRemove(cred.ApiKey, out _);
                continue;
            }
            if (res.StatusCode == HttpStatusCode.Unauthorized)
                throw new PropertyFinderAuthException("Property Finder rejected the API key — it may have expired or been revoked.");

            if (res.StatusCode == HttpStatusCode.Forbidden)
                throw new PropertyFinderScopeException(
                    $"The Property Finder API key lacks the scope required for {path}. Scopes are fixed when a key is created — a new key is needed.");

            if ((res.StatusCode == HttpStatusCode.TooManyRequests || (int)res.StatusCode >= 500) && attempt < maxAttempts)
            {
                // Incremental backoff with jitter, exactly as the API docs recommend.
                var delay = TimeSpan.FromMilliseconds(500 * Math.Pow(2, attempt - 1) + Random.Shared.Next(0, 400));
                logger.LogWarning("Property Finder {Status} on {Path}; retry {Attempt}/{Max} in {Delay}ms",
                    (int)res.StatusCode, path, attempt, maxAttempts, delay.TotalMilliseconds);
                await Task.Delay(delay, ct);
                continue;
            }

            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
                throw new PropertyFinderApiException($"Property Finder {(int)res.StatusCode} on {path}. {Trim(body)}");

            return JsonDocument.Parse(body).RootElement.Clone();
        }
    }

    // ── Paging ──────────────────────────────────────────────────────────────────

    /// <summary>One page of results plus the cursor needed to decide whether to continue.</summary>
    public sealed record Page(IReadOnlyList<JsonElement> Items, int PageNumber, int TotalPages, int Total);

    private static Page ReadPage(JsonElement root, string itemsProperty)
    {
        var items = root.TryGetProperty(itemsProperty, out var arr) && arr.ValueKind == JsonValueKind.Array
            ? arr.EnumerateArray().ToList()
            : [];

        var page = 1; var totalPages = 1; var total = items.Count;
        if (root.TryGetProperty("pagination", out var p) && p.ValueKind == JsonValueKind.Object)
        {
            if (p.TryGetProperty("page", out var v1) && v1.TryGetInt32(out var a)) page = a;
            if (p.TryGetProperty("totalPages", out var v2) && v2.TryGetInt32(out var b)) totalPages = b;
            if (p.TryGetProperty("total", out var v3) && v3.TryGetInt32(out var c)) total = c;
        }
        return new Page(items, page, totalPages, total);
    }

    // perPage is capped at 50 by the API; asking for more is a 400.
    private const int MaxPerPage = 50;

    /// <summary>
    /// One page of leads. <paramref name="createdAtFrom"/> is the incremental cursor for the live
    /// sync — but note the API rejects a value older than 3 months, so the historical backfill must
    /// page WITHOUT a date filter (unfiltered paging does return the full history).
    /// </summary>
    public async Task<Page> GetLeadsPageAsync(Credentials cred, int page, DateTime? createdAtFrom, CancellationToken ct)
    {
        var q = new StringBuilder($"/v1/leads?perPage={MaxPerPage}&page={page}");
        if (createdAtFrom is { } from)
            q.Append("&createdAtFrom=").Append(Uri.EscapeDataString(from.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")));
        return ReadPage(await GetAsync(q.ToString(), cred, ct), "data");
    }

    public async Task<Page> GetUsersPageAsync(Credentials cred, int page, CancellationToken ct) =>
        ReadPage(await GetAsync($"/v1/users?perPage={MaxPerPage}&page={page}", cred, ct), "data");

    public async Task<IReadOnlyList<JsonElement>> GetRolesAsync(Credentials cred, CancellationToken ct)
    {
        var root = await GetAsync("/v1/roles", cred, ct);
        if (root.ValueKind == JsonValueKind.Array) return root.EnumerateArray().ToList();
        return root.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.Array
            ? d.EnumerateArray().ToList() : [];
    }

    /// <summary>
    /// Listings by id, batched. A lead carries only <c>listing.id</c> + reference, so this is the
    /// only way to get the property title and price — which become the lead's "Interested in" and
    /// "Budget". Note the response array is <c>results</c> here, not <c>data</c> as elsewhere.
    /// </summary>
    public async Task<IReadOnlyList<JsonElement>> GetListingsByIdsAsync(
        Credentials cred, IReadOnlyCollection<string> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        var results = new List<JsonElement>(ids.Count);

        foreach (var batch in ids.Distinct().Chunk(MaxPerPage))
        {
            var q = new StringBuilder("/v1/listings?perPage=").Append(MaxPerPage);
            foreach (var id in batch)
                q.Append("&filter%5Bids%5D%5B%5D=").Append(Uri.EscapeDataString(id));

            var root = await GetAsync(q.ToString(), cred, ct);
            if (root.TryGetProperty("results", out var arr) && arr.ValueKind == JsonValueKind.Array)
                results.AddRange(arr.EnumerateArray().Select(x => x.Clone()));
        }
        return results;
    }

    // ── Webhooks (live sync) ────────────────────────────────────────────────────

    public async Task<IReadOnlyList<JsonElement>> ListWebhooksAsync(Credentials cred, CancellationToken ct)
    {
        var root = await GetAsync("/v1/webhooks", cred, ct);
        return root.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.Array
            ? d.EnumerateArray().Select(x => x.Clone()).ToList() : [];
    }

    /// <summary>Subscribe to an event (e.g. <c>lead.created</c>). Secret enables HMAC signing.</summary>
    public async Task SubscribeAsync(Credentials cred, string eventId, string callbackUrl, string? secret, CancellationToken ct)
    {
        var token = await GetTokenAsync(cred, ct);
        var http  = httpFactory.CreateClient("property-finder");

        object payload = string.IsNullOrWhiteSpace(secret)
            ? new { eventId, callbackUrl }
            : new { eventId, callbackUrl, secret };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{_o.BaseUrl}/v1/webhooks")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        req.Headers.Add("Authorization", $"Bearer {token}");

        using var res = await http.SendAsync(req, ct);
        // 409 = already subscribed to this event for this URL. Re-registering is a no-op, not a failure.
        if (res.StatusCode == HttpStatusCode.Conflict) return;
        if (!res.IsSuccessStatusCode)
            throw new PropertyFinderApiException(
                $"Could not subscribe to '{eventId}' ({(int)res.StatusCode}). {Trim(await res.Content.ReadAsStringAsync(ct))}");
    }

    private static string Trim(string s) => s.Length > 400 ? s[..400] : s;
}

public class PropertyFinderApiException(string message) : Exception(message);
public sealed class PropertyFinderAuthException(string message) : PropertyFinderApiException(message);
public sealed class PropertyFinderScopeException(string message) : PropertyFinderApiException(message);
