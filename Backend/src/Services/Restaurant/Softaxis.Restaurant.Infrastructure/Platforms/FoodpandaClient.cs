using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Softaxis.Restaurant.Infrastructure.Platforms;

/// <summary>
/// Calls to Foodpanda's order middleware (Delivery Hero "POS plugin" integration): sign in, accept,
/// reject, picked up. Sandbox is Delivery Hero's staging middleware.
/// </summary>
public sealed class FoodpandaClient(IHttpClientFactory http, IConfiguration config)
{
    public sealed record Outcome(bool Ok, string Message);

    private string BaseUrl(string env) => (env == "production"
        ? config["Foodpanda:ProductionBaseUrl"] ?? "https://integration-middleware-as.restaurant-partners.com"
        : config["Foodpanda:SandboxBaseUrl"] ?? "https://integration-middleware.stg.restaurant-partners.com").TrimEnd('/');

    // Access tokens are reused until shortly before they expire; keyed per environment + user.
    private static readonly ConcurrentDictionary<string, (string Token, DateTime ExpiresAt)> Tokens = new();

    public async Task<(string? Token, string Message)> SignInAsync(string env, string username, string password, CancellationToken ct, bool fresh = false)
    {
        var key = $"{env}|{username}";
        if (!fresh && Tokens.TryGetValue(key, out var cached) && cached.ExpiresAt > DateTime.UtcNow.AddMinutes(1))
            return (cached.Token, "ok");

        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["username"] = username, ["password"] = password, ["grant_type"] = "client_credentials",
        });
        try
        {
            using var res = await Client().PostAsync($"{BaseUrl(env)}/v2/login", form, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
                return (null, $"Foodpanda refused the sign-in ({(int)res.StatusCode}): {Trim(body)}");
            using var doc = JsonDocument.Parse(body);
            var token = doc.RootElement.TryGetProperty("access_token", out var t) ? t.GetString() : null;
            if (string.IsNullOrEmpty(token)) return (null, "Foodpanda's sign-in answer had no access token.");
            var seconds = doc.RootElement.TryGetProperty("expires_in", out var e) && e.TryGetInt32(out var s) ? s : 1800;
            Tokens[key] = (token, DateTime.UtcNow.AddSeconds(seconds));
            return (token, "Signed in to Foodpanda.");
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
        {
            return (null, $"Could not reach Foodpanda: {ex.Message}");
        }
    }

    public Task<Outcome> AcceptAsync(Creds c, string orderToken, string remoteOrderId, DateTime readyAtUtc, CancellationToken ct) =>
        SendStatusAsync(c, orderToken, new
        {
            acceptanceTime = readyAtUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'"),
            remoteOrderId, status = "order_accepted",
        }, ct);

    public Task<Outcome> RejectAsync(Creds c, string orderToken, string reason, string? message, CancellationToken ct) =>
        SendStatusAsync(c, orderToken, new { reason, message = message ?? "", status = "order_rejected" }, ct);

    public Task<Outcome> PickedUpAsync(Creds c, string orderToken, CancellationToken ct) =>
        SendStatusAsync(c, orderToken, new { status = "order_picked_up" }, ct);

    public sealed record Creds(string Environment, string Username, string Password);

    private async Task<Outcome> SendStatusAsync(Creds c, string orderToken, object body, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var (token, msg) = await SignInAsync(c.Environment, c.Username, c.Password, ct, fresh: attempt > 0);
            if (token is null) return new(false, msg);
            using var req = new HttpRequestMessage(HttpMethod.Post,
                $"{BaseUrl(c.Environment)}/v2/order/status/{Uri.EscapeDataString(orderToken)}")
            { Content = JsonContent.Create(body) };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            try
            {
                using var res = await Client().SendAsync(req, ct);
                if (res.IsSuccessStatusCode) return new(true, "ok");
                // A stale token: sign in again once.
                if ((int)res.StatusCode == 401 && attempt == 0) continue;
                return new(false, $"Foodpanda answered {(int)res.StatusCode}: {Trim(await res.Content.ReadAsStringAsync(ct))}");
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                return new(false, $"Could not reach Foodpanda: {ex.Message}");
            }
        }
        return new(false, "Foodpanda did not accept the sign-in.");
    }

    private HttpClient Client()
    {
        var c = http.CreateClient("foodpanda");
        c.Timeout = TimeSpan.FromSeconds(15);
        return c;
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;
}
