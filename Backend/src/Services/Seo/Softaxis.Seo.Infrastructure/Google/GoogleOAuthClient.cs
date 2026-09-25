using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Softaxis.Seo.Infrastructure.Google;

/// <summary>
/// Thin hand-rolled Google OAuth + API client, mirroring CRM's MetaGraphClient — this codebase has
/// no shared OAuth helper and pulls in no provider SDK anywhere, by established convention.
///
/// <para><b>Scope note:</b> the public Search Console API only exposes Search Analytics (clicks/
/// impressions/position) and Sitemaps — it does NOT expose the Index Coverage or Core Web Vitals
/// reports (those are Search Console UI-only). Phase 1 therefore uses GSC connection for property
/// ownership + future reporting, not as a source of "issues" — issue detection is crawl-based
/// (see SiteCrawler). Claiming a GSC "coverage issues" API that does not exist would be worse than
/// not building it.</para>
/// </summary>
public sealed class GoogleOAuthClient(IHttpClientFactory httpFactory, IOptions<GoogleOptions> options, ILogger<GoogleOAuthClient> logger)
{
    private readonly GoogleOptions _o = options.Value;
    private const string AuthEndpoint  = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";

    public string BuildLoginUrl(string redirectUri, string state) =>
        $"{AuthEndpoint}?client_id={Uri.EscapeDataString(_o.ClientId)}" +
        $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
        $"&response_type=code&access_type=offline&prompt=consent" + // offline + consent: guarantees a refresh_token
        $"&scope={Uri.EscapeDataString(_o.Scopes)}" +
        $"&state={Uri.EscapeDataString(state)}";

    public sealed record TokenResult(string AccessToken, string? RefreshToken, DateTime ExpiresAt);

    public async Task<TokenResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct)
    {
        var form = new Dictionary<string, string>
        {
            ["code"]          = code,
            ["client_id"]     = _o.ClientId,
            ["client_secret"] = _o.ClientSecret,
            ["redirect_uri"]  = redirectUri,
            ["grant_type"]    = "authorization_code",
        };
        var root = await PostFormAsync(form, ct);
        return ToTokenResult(root, keepExistingRefreshToken: null);
    }

    public async Task<TokenResult> RefreshAccessTokenAsync(string refreshToken, CancellationToken ct)
    {
        var form = new Dictionary<string, string>
        {
            ["refresh_token"] = refreshToken,
            ["client_id"]     = _o.ClientId,
            ["client_secret"] = _o.ClientSecret,
            ["grant_type"]    = "refresh_token",
        };
        var root = await PostFormAsync(form, ct);
        // Google does not re-issue the refresh token on a refresh call — keep the one we already have.
        return ToTokenResult(root, keepExistingRefreshToken: refreshToken);
    }

    public sealed record GscProperty(string SiteUrl, string PermissionLevel);

    /// <summary>The tenant's verified Search Console properties — verification is proven by Google
    /// itself (only properties the connected account already owns are ever listed here).</summary>
    public async Task<IReadOnlyList<GscProperty>> GetSearchConsolePropertiesAsync(string accessToken, CancellationToken ct)
    {
        var root = await GetJsonAsync("https://www.googleapis.com/webmasters/v3/sites", accessToken, ct);
        if (!root.TryGetProperty("siteEntry", out var entries)) return [];
        return entries.EnumerateArray()
            .Select(e => new GscProperty(
                e.GetProperty("siteUrl").GetString() ?? "",
                e.TryGetProperty("permissionLevel", out var p) ? p.GetString() ?? "" : ""))
            .Where(p => !string.IsNullOrEmpty(p.SiteUrl))
            .ToList();
    }

    public sealed record SearchQueryRow(string Query, double Clicks, double Impressions, double Position);

    /// <summary>Real Search Analytics data for the connected property — actual queries this site
    /// already gets impressions/clicks for, over the last 90 days. This is the one genuine "what does
    /// Google already associate with this site" signal available (see this class's own scope note on
    /// what the public API does and does not expose) — used by ContentResearch as a content-gap
    /// signal: a query with meaningful impressions but a weak position/CTR is a real opportunity, not
    /// a guess.</summary>
    public async Task<IReadOnlyList<SearchQueryRow>> GetSearchAnalyticsAsync(string accessToken, string siteUrl, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("google");
        var url = $"https://www.googleapis.com/webmasters/v3/sites/{Uri.EscapeDataString(siteUrl)}/searchAnalytics/query";
        var body = JsonSerializer.Serialize(new
        {
            startDate  = DateTime.UtcNow.AddDays(-90).ToString("yyyy-MM-dd"),
            endDate    = DateTime.UtcNow.AddDays(-3).ToString("yyyy-MM-dd"), // GSC data lags a few days
            dimensions = new[] { "query" },
            rowLimit   = 100,
        });
        using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await client.SendAsync(request, ct);
        var respBody = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("Google Search Analytics error {Status}: {Body}", (int)resp.StatusCode, respBody);
            return []; // a research signal being unavailable must not fail article generation
        }

        var root = JsonDocument.Parse(respBody).RootElement;
        if (!root.TryGetProperty("rows", out var rows)) return [];
        return rows.EnumerateArray()
            .Select(r =>
            {
                var keys = r.GetProperty("keys");
                return new SearchQueryRow(
                    keys[0].GetString() ?? "",
                    r.TryGetProperty("clicks", out var c) ? c.GetDouble() : 0,
                    r.TryGetProperty("impressions", out var i) ? i.GetDouble() : 0,
                    r.TryGetProperty("position", out var p) ? p.GetDouble() : 0);
            })
            .Where(q => !string.IsNullOrEmpty(q.Query))
            .ToList();
    }

    public sealed record Ga4Property(string PropertyId, string DisplayName);

    public async Task<IReadOnlyList<Ga4Property>> GetAnalyticsPropertiesAsync(string accessToken, CancellationToken ct)
    {
        var root = await GetJsonAsync("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", accessToken, ct);
        if (!root.TryGetProperty("accountSummaries", out var accounts)) return [];

        var result = new List<Ga4Property>();
        foreach (var account in accounts.EnumerateArray())
        {
            if (!account.TryGetProperty("propertySummaries", out var props)) continue;
            foreach (var p in props.EnumerateArray())
            {
                var propertyName = p.TryGetProperty("property", out var pn) ? pn.GetString() : null; // "properties/123456"
                var displayName  = p.TryGetProperty("displayName", out var dn) ? dn.GetString() : null;
                if (!string.IsNullOrEmpty(propertyName))
                    result.Add(new Ga4Property(propertyName!, displayName ?? propertyName!));
            }
        }
        return result;
    }

    private static TokenResult ToTokenResult(JsonElement root, string? keepExistingRefreshToken)
    {
        var accessToken  = root.GetProperty("access_token").GetString()!;
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : keepExistingRefreshToken;
        var expiresIn    = root.TryGetProperty("expires_in", out var e) && e.TryGetInt64(out var secs) ? secs : 3600;
        return new TokenResult(accessToken, refreshToken, DateTime.UtcNow.AddSeconds(expiresIn));
    }

    private async Task<JsonElement> PostFormAsync(IReadOnlyDictionary<string, string> form, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("google");
        using var content = new FormUrlEncodedContent(form);
        using var resp = await client.PostAsync(TokenEndpoint, content, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("Google token endpoint error {Status}: {Body}", (int)resp.StatusCode, body);
            throw new InvalidOperationException($"Google OAuth token exchange failed ({(int)resp.StatusCode}).");
        }
        return JsonDocument.Parse(body).RootElement.Clone();
    }

    private async Task<JsonElement> GetJsonAsync(string url, string accessToken, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("google");
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await client.SendAsync(request, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("Google API error {Status} for {Url}: {Body}", (int)resp.StatusCode, url, body);
            throw new InvalidOperationException($"Google API call failed ({(int)resp.StatusCode}).");
        }
        return JsonDocument.Parse(body).RootElement.Clone();
    }
}
