using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Softaxis.Calendar.Infrastructure.Google;

/// <summary>
/// Bound from the shared "Google" config section (the same app registration SEO uses): set
/// Google__ClientId / Google__ClientSecret on the server, never in source. The Calendar scopes are
/// requested here, on their own consent screen, so connecting a calendar never widens what SEO holds.
/// </summary>
public sealed class GoogleCalendarOptions
{
    public const string Section = "Google";
    public string ClientId     { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string CalendarScopes { get; set; } =
        "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";
}

/// <summary>A Google call that failed. <see cref="Gone"/> = a stale sync cursor (HTTP 410).</summary>
public sealed class GoogleApiException(HttpStatusCode status, string message) : Exception(message)
{
    public HttpStatusCode Status { get; } = status;
    public bool Gone => Status == HttpStatusCode.Gone;
    /// <summary>The refresh token was revoked or expired - only the user can fix this, by reconnecting.</summary>
    public bool NeedsReconnect { get; init; }
}

/// <summary>Thin hand-rolled Google Calendar + OAuth client (no SDK, by this codebase's convention).</summary>
public sealed class GoogleCalendarClient(IHttpClientFactory httpFactory, IOptions<GoogleCalendarOptions> options)
{
    private readonly GoogleCalendarOptions _o = options.Value;
    private const string AuthEndpoint  = "https://accounts.google.com/o/oauth2/v2/auth";
    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";
    private const string Api           = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_o.ClientId) && !string.IsNullOrWhiteSpace(_o.ClientSecret);

    public string BuildLoginUrl(string redirectUri, string state) =>
        $"{AuthEndpoint}?client_id={Uri.EscapeDataString(_o.ClientId)}" +
        $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
        "&response_type=code&access_type=offline&prompt=consent" + // offline + consent guarantees a refresh token
        $"&scope={Uri.EscapeDataString(_o.CalendarScopes)}" +
        $"&state={Uri.EscapeDataString(state)}";

    public sealed record TokenResult(string AccessToken, string? RefreshToken, DateTime ExpiresAt);

    public Task<TokenResult> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct) =>
        TokenAsync(new Dictionary<string, string>
        {
            ["code"] = code, ["client_id"] = _o.ClientId, ["client_secret"] = _o.ClientSecret,
            ["redirect_uri"] = redirectUri, ["grant_type"] = "authorization_code",
        }, keepRefreshToken: null, ct);

    public Task<TokenResult> RefreshAsync(string refreshToken, CancellationToken ct) =>
        TokenAsync(new Dictionary<string, string>
        {
            ["refresh_token"] = refreshToken, ["client_id"] = _o.ClientId,
            ["client_secret"] = _o.ClientSecret, ["grant_type"] = "refresh_token",
        }, keepRefreshToken: refreshToken, ct);

    private async Task<TokenResult> TokenAsync(Dictionary<string, string> form, string? keepRefreshToken, CancellationToken ct)
    {
        using var http = httpFactory.CreateClient("google-calendar");
        using var res = await http.PostAsync(TokenEndpoint, new FormUrlEncodedContent(form), ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            // invalid_grant = the user revoked access (or the token aged out): retrying cannot help.
            var revoked = body.Contains("invalid_grant", StringComparison.OrdinalIgnoreCase);
            throw new GoogleApiException(res.StatusCode,
                revoked ? "Google access was revoked or expired. Reconnect your Google account."
                        : $"Google sign-in failed ({(int)res.StatusCode}).") { NeedsReconnect = revoked };
        }
        var root = JsonSerializer.Deserialize<JsonElement>(body);
        // Google does not re-issue the refresh token on a refresh call - keep the one we have.
        var refresh = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : keepRefreshToken;
        var seconds = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
        return new TokenResult(root.GetProperty("access_token").GetString()!, refresh, DateTime.UtcNow.AddSeconds(seconds));
    }

    public async Task<string?> GetAccountEmailAsync(string accessToken, CancellationToken ct)
    {
        var root = await SendAsync(HttpMethod.Get, "https://www.googleapis.com/oauth2/v2/userinfo", accessToken, null, ct);
        return root?.TryGetProperty("email", out var e) == true ? e.GetString() : null;
    }

    public sealed record ListResult(List<JsonElement> Items, string? NextSyncToken);

    /// <summary>
    /// Lists events. With a sync token Google returns only what changed since (including cancellations);
    /// without one, the window starts at <paramref name="timeMin"/>. Recurring events arrive already
    /// expanded into single instances (singleEvents), so every item is one calendar entry.
    /// </summary>
    public async Task<ListResult> ListAsync(string accessToken, string? syncToken, DateTime timeMin, CancellationToken ct)
    {
        var items = new List<JsonElement>();
        string? pageToken = null, next = null;
        do
        {
            var url = $"{Api}?singleEvents=true&showDeleted=true&maxResults=250";
            url += syncToken is not null
                ? $"&syncToken={Uri.EscapeDataString(syncToken)}"
                : $"&timeMin={Uri.EscapeDataString(timeMin.ToString("o"))}";
            if (pageToken is not null) url += $"&pageToken={Uri.EscapeDataString(pageToken)}";

            var root = await SendAsync(HttpMethod.Get, url, accessToken, null, ct)
                       ?? throw new GoogleApiException(HttpStatusCode.BadGateway, "Google returned an empty answer.");
            if (root.TryGetProperty("items", out var arr)) items.AddRange(arr.EnumerateArray().Select(i => i.Clone()));
            pageToken = root.TryGetProperty("nextPageToken", out var np) ? np.GetString() : null;
            if (root.TryGetProperty("nextSyncToken", out var st)) next = st.GetString();
        } while (pageToken is not null);

        return new ListResult(items, next);
    }

    public async Task<JsonElement> InsertAsync(string accessToken, object body, bool withMeet, CancellationToken ct)
    {
        var url = $"{Api}?sendUpdates=all" + (withMeet ? "&conferenceDataVersion=1" : "");
        return await SendAsync(HttpMethod.Post, url, accessToken, body, ct)
               ?? throw new GoogleApiException(HttpStatusCode.BadGateway, "Google returned an empty answer.");
    }

    public async Task<JsonElement> PatchAsync(string accessToken, string eventId, object body, bool withMeet, CancellationToken ct)
    {
        var url = $"{Api}/{Uri.EscapeDataString(eventId)}?sendUpdates=all" + (withMeet ? "&conferenceDataVersion=1" : "");
        return await SendAsync(HttpMethod.Patch, url, accessToken, body, ct)
               ?? throw new GoogleApiException(HttpStatusCode.BadGateway, "Google returned an empty answer.");
    }

    /// <summary>Deleting something already gone (404 / 410) is success - the goal state is reached.</summary>
    public async Task DeleteAsync(string accessToken, string eventId, CancellationToken ct)
    {
        try { await SendAsync(HttpMethod.Delete, $"{Api}/{Uri.EscapeDataString(eventId)}?sendUpdates=all", accessToken, null, ct); }
        catch (GoogleApiException ex) when (ex.Status is HttpStatusCode.NotFound or HttpStatusCode.Gone) { }
    }

    private async Task<JsonElement?> SendAsync(HttpMethod method, string url, string accessToken, object? body, CancellationToken ct)
    {
        using var http = httpFactory.CreateClient("google-calendar");
        using var req = new HttpRequestMessage(method, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (body is not null) req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        using var res = await http.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            var message = $"Google Calendar refused the request ({(int)res.StatusCode}).";
            try
            {
                var err = JsonSerializer.Deserialize<JsonElement>(text);
                if (err.TryGetProperty("error", out var e) && e.TryGetProperty("message", out var m) && m.GetString() is { Length: > 0 } s)
                    message = s;
            }
            catch (JsonException) { }
            throw new GoogleApiException(res.StatusCode, message)
            {
                NeedsReconnect = res.StatusCode == HttpStatusCode.Unauthorized,
            };
        }
        return string.IsNullOrWhiteSpace(text) ? null : JsonSerializer.Deserialize<JsonElement>(text);
    }
}
