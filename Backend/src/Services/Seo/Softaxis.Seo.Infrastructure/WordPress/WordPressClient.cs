using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Softaxis.Seo.Infrastructure.WordPress;

/// <summary>
/// Thin hand-rolled WordPress REST API client — mirrors GoogleOAuthClient's own shape (no SDK, no
/// shared HTTP helper, by this codebase's established convention). Authenticates with a WordPress
/// "Application Password" (WordPress's own scoped-credential feature since 5.6 — NOT the account's
/// real login password), sent as HTTP Basic auth, which is what the WP REST API itself expects for
/// this credential type.
/// </summary>
public sealed class WordPressClient(IHttpClientFactory httpFactory, ILogger<WordPressClient> logger)
{
    public sealed record WhoAmI(int Id, string Name);

    public async Task<WhoAmI> TestConnectionAsync(string siteUrl, string username, string appPassword, CancellationToken ct)
    {
        var root = await GetJsonAsync($"{siteUrl}/wp-json/wp/v2/users/me", username, appPassword, ct);
        return new WhoAmI(
            root.TryGetProperty("id", out var id) ? id.GetInt32() : 0,
            root.TryGetProperty("name", out var name) ? name.GetString() ?? username : username);
    }

    /// <summary>Creates a WP post. <paramref name="status"/> is "draft" (the safe default — see
    /// SeoWordPressConnection.AutoPublish) or "publish" when the tenant explicitly opted in.</summary>
    public async Task<int> CreatePostAsync(string siteUrl, string username, string appPassword,
        string title, string contentHtml, string status, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("wordpress");
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{siteUrl}/wp-json/wp/v2/posts");
        request.Headers.Authorization = BasicAuth(username, appPassword);
        var body = JsonSerializer.Serialize(new { title, content = contentHtml, status });
        request.Content = new StringContent(body, Encoding.UTF8, "application/json");

        using var resp = await client.SendAsync(request, ct);
        var respBody = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("WordPress create-post error {Status}: {Body}", (int)resp.StatusCode, respBody);
            throw new InvalidOperationException($"WordPress rejected the post ({(int)resp.StatusCode}).");
        }
        var root = JsonDocument.Parse(respBody).RootElement;
        return root.GetProperty("id").GetInt32();
    }

    private async Task<JsonElement> GetJsonAsync(string url, string username, string appPassword, CancellationToken ct)
    {
        var client = httpFactory.CreateClient("wordpress");
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = BasicAuth(username, appPassword);
        using var resp = await client.SendAsync(request, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            logger.LogWarning("WordPress API error {Status} for {Url}: {Body}", (int)resp.StatusCode, url, body);
            throw new InvalidOperationException($"Could not reach WordPress ({(int)resp.StatusCode}). Check the site URL, username and application password.");
        }
        return JsonDocument.Parse(body).RootElement.Clone();
    }

    private static AuthenticationHeaderValue BasicAuth(string username, string appPassword) =>
        new("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{appPassword}")));
}
