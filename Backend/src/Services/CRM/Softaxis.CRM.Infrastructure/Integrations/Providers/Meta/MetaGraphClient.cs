using System.Net.Http;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;

/// <summary>
/// Thin Facebook Graph API client for the Lead Ads flow: OAuth token exchange, page/form
/// discovery, page webhook subscription, and lead retrieval. All calls are read-as-string +
/// JsonDocument to avoid extra serialization dependencies.
/// </summary>
public sealed class MetaGraphClient(IHttpClientFactory httpFactory, IOptions<MetaOptions> options, ILogger<MetaGraphClient> logger)
{
    private readonly MetaOptions _o = options.Value;
    private string Base => $"https://graph.facebook.com/{_o.GraphVersion}";

    public string BuildLoginUrl(string redirectUri, string state) =>
        $"https://www.facebook.com/{_o.GraphVersion}/dialog/oauth" +
        $"?client_id={Uri.EscapeDataString(_o.AppId)}" +
        $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
        $"&state={Uri.EscapeDataString(state)}" +
        $"&response_type=code&scope={Uri.EscapeDataString(_o.Scopes)}";

    /// <summary>Exchange an auth code for a long-lived user access token.</summary>
    public async Task<(string Token, DateTime? ExpiresAt)> ExchangeCodeAsync(string code, string redirectUri, CancellationToken ct)
    {
        var shortUrl = $"{Base}/oauth/access_token?client_id={Uri.EscapeDataString(_o.AppId)}" +
                       $"&redirect_uri={Uri.EscapeDataString(redirectUri)}" +
                       $"&client_secret={Uri.EscapeDataString(_o.AppSecret)}&code={Uri.EscapeDataString(code)}";
        var shortToken = (await GetJsonAsync(shortUrl, ct)).RootElement.GetProperty("access_token").GetString()!;

        var longUrl = $"{Base}/oauth/access_token?grant_type=fb_exchange_token" +
                      $"&client_id={Uri.EscapeDataString(_o.AppId)}&client_secret={Uri.EscapeDataString(_o.AppSecret)}" +
                      $"&fb_exchange_token={Uri.EscapeDataString(shortToken)}";
        var root = (await GetJsonAsync(longUrl, ct)).RootElement;
        var token = root.GetProperty("access_token").GetString()!;
        DateTime? expires = root.TryGetProperty("expires_in", out var e) && e.TryGetInt64(out var secs)
            ? DateTime.UtcNow.AddSeconds(secs) : null;
        return (token, expires);
    }

    public async Task<string?> GetUserNameAsync(string userToken, CancellationToken ct)
    {
        try
        {
            var root = (await GetJsonAsync($"{Base}/me?fields=name&access_token={Uri.EscapeDataString(userToken)}", ct)).RootElement;
            return root.TryGetProperty("name", out var n) ? n.GetString() : null;
        }
        catch { return null; }
    }

    public sealed record MetaPage(string Id, string Name, string AccessToken);

    public async Task<IReadOnlyList<MetaPage>> GetPagesAsync(string userToken, CancellationToken ct)
    {
        var url = $"{Base}/me/accounts?fields=id,name,access_token&limit=200&access_token={Uri.EscapeDataString(userToken)}";
        var data = (await GetJsonAsync(url, ct)).RootElement.GetProperty("data");
        return data.EnumerateArray()
            .Select(p => new MetaPage(
                p.GetProperty("id").GetString()!,
                p.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "",
                p.TryGetProperty("access_token", out var t) ? t.GetString() ?? "" : ""))
            .Where(p => !string.IsNullOrEmpty(p.AccessToken))
            .ToList();
    }

    public sealed record MetaForm(string Id, string Name);

    public async Task<IReadOnlyList<MetaForm>> GetFormsAsync(string pageId, string pageToken, CancellationToken ct)
    {
        var url = $"{Base}/{pageId}/leadgen_forms?fields=id,name,status&limit=200&access_token={Uri.EscapeDataString(pageToken)}";
        var data = (await GetJsonAsync(url, ct)).RootElement.GetProperty("data");
        return data.EnumerateArray()
            .Select(f => new MetaForm(f.GetProperty("id").GetString()!, f.TryGetProperty("name", out var n) ? n.GetString() ?? "" : ""))
            .ToList();
    }

    /// <summary>Subscribe the app to a page's leadgen webhooks.</summary>
    public async Task<bool> SubscribePageAsync(string pageId, string pageToken, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("meta");
        var url = $"{Base}/{pageId}/subscribed_apps?subscribed_fields=leadgen&access_token={Uri.EscapeDataString(pageToken)}";
        using var resp = await client.PostAsync(url, content: null, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("Meta SubscribePage {Page} failed: {Body}", pageId, body);
            return false;
        }
        return true;
    }

    /// <summary>Retrieve a single lead's field data + attribution by leadgen id.</summary>
    public async Task<JsonElement> GetLeadAsync(string leadgenId, string pageToken, CancellationToken ct)
    {
        var fields = "id,created_time,field_data,campaign_id,campaign_name,adset_id,adset_name,ad_id,form_id,platform";
        var url = $"{Base}/{leadgenId}?fields={fields}&access_token={Uri.EscapeDataString(pageToken)}";
        return (await GetJsonAsync(url, ct)).RootElement.Clone();
    }

    /// <summary>Poll recent leads for a form (used by scheduled sync).</summary>
    public async Task<IReadOnlyList<JsonElement>> GetFormLeadsAsync(string formId, string pageToken, DateTime? since, CancellationToken ct)
    {
        var fields = "id,created_time,field_data,campaign_id,campaign_name,adset_id,ad_id,form_id,platform";
        var url = $"{Base}/{formId}/leads?fields={fields}&limit=200&access_token={Uri.EscapeDataString(pageToken)}";
        if (since is not null)
            url += $"&filtering=[{{\"field\":\"time_created\",\"operator\":\"GREATER_THAN\",\"value\":{((DateTimeOffset)since.Value).ToUnixTimeSeconds()}}}]";
        var data = (await GetJsonAsync(url, ct)).RootElement.GetProperty("data");
        return data.EnumerateArray().Select(e => e.Clone()).ToList();
    }

    private async Task<JsonDocument> GetJsonAsync(string url, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("meta");
        using var resp = await client.GetAsync(url, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Meta Graph error {(int)resp.StatusCode}: {body}");
        return JsonDocument.Parse(body);
    }
}
