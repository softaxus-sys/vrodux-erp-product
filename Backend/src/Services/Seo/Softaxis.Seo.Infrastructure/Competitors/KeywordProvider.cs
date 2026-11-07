using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Softaxis.Seo.Infrastructure.Competitors;

/// <summary>One search term a website ranks for.</summary>
public sealed record KeywordRow(string Keyword, int Volume, int? Difficulty, int Position, string? Url);

/// <summary>The keyword provider refused or failed. The message is safe to show to a customer (it never contains credentials).</summary>
public sealed class KeywordProviderException(string message) : Exception(message);

public interface IKeywordDataProvider
{
    bool IsConfigured { get; }
    /// <summary>The terms <paramref name="domain"/> ranks for in Google, highest search volume first.</summary>
    Task<IReadOnlyList<KeywordRow>> RankedKeywordsAsync(string domain, int locationCode, CancellationToken ct);
}

/// <summary>
/// The platform's DataForSEO account — one account for every workspace, paid for by us and recovered through credits. The login and
/// password come only from server configuration (<c>DataForSeo__Login</c> / <c>DataForSeo__Password</c>), never from a tenant or the repo.
/// </summary>
public sealed class DataForSeoOptions
{
    public string Login { get; init; } = "";
    public string Password { get; init; } = "";
    public string BaseUrl { get; init; } = "https://api.dataforseo.com";
    /// <summary>Most keywords bought per website — bounds what one comparison costs us.</summary>
    public int MaxItemsPerDomain { get; init; } = 300;

    public bool IsConfigured => Login.Length > 0 && Password.Length > 0;

    public static DataForSeoOptions From(IConfiguration c)
    {
        var s = c.GetSection("DataForSeo");
        return new DataForSeoOptions
        {
            Login = s["Login"]?.Trim() ?? "",
            Password = s["Password"] ?? "",
            BaseUrl = (s["BaseUrl"] is { Length: > 0 } b ? b : "https://api.dataforseo.com").TrimEnd('/'),
            MaxItemsPerDomain = Math.Clamp(s.GetValue<int?>("MaxItemsPerDomain") ?? 300, 20, 1000),
        };
    }
}

public sealed class DataForSeoClient(IHttpClientFactory httpFactory, DataForSeoOptions options, ILogger<DataForSeoClient> logger) : IKeywordDataProvider
{
    public const string ClientName = "dataforseo";

    public bool IsConfigured => options.IsConfigured;

    public async Task<IReadOnlyList<KeywordRow>> RankedKeywordsAsync(string domain, int locationCode, CancellationToken ct)
    {
        if (!options.IsConfigured) throw new KeywordProviderException("Keyword data is not set up on this server.");

        var body = JsonSerializer.Serialize(new[]
        {
            new Dictionary<string, object?>
            {
                ["target"] = domain,
                ["location_code"] = locationCode,
                ["language_code"] = "en",
                ["limit"] = options.MaxItemsPerDomain,
                ["order_by"] = new[] { "keyword_data.keyword_info.search_volume,desc" },
            },
        });

        var http = httpFactory.CreateClient(ClientName);
        http.Timeout = TimeSpan.FromSeconds(90);
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{options.BaseUrl}/v3/dataforseo_labs/google/ranked_keywords/live")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{options.Login}:{options.Password}")));

        HttpResponseMessage res;
        try { res = await http.SendAsync(req, ct); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "DataForSEO request for {Domain} failed.", domain);
            throw new KeywordProviderException("The keyword data service could not be reached. Try again later.");
        }

        using (res)
        {
            var text = await res.Content.ReadAsStringAsync(ct);
            if (res.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
            {
                logger.LogError("DataForSEO rejected the configured credentials (HTTP {Status}).", (int)res.StatusCode);
                throw new KeywordProviderException("The keyword data service rejected our account. The platform owner has been told to check it.");
            }
            if (!res.IsSuccessStatusCode)
            {
                logger.LogWarning("DataForSEO answered HTTP {Status} for {Domain}.", (int)res.StatusCode, domain);
                throw new KeywordProviderException("The keyword data service had a problem. Try again later.");
            }
            return Parse(text, domain, logger);
        }
    }

    /// <summary>Reads a ranked_keywords response. Public so the reading rules are unit-tested without the network.</summary>
    public static IReadOnlyList<KeywordRow> Parse(string json, string domain, ILogger? logger = null)
    {
        JsonDocument doc;
        try { doc = JsonDocument.Parse(json); }
        catch (JsonException) { throw new KeywordProviderException("The keyword data service sent an answer we could not read."); }

        using (doc)
        {
            var root = doc.RootElement;
            if (!root.TryGetProperty("tasks", out var tasks) || tasks.ValueKind != JsonValueKind.Array || tasks.GetArrayLength() == 0)
                throw new KeywordProviderException("The keyword data service sent an unexpected answer.");

            var task = tasks[0];
            var code = task.TryGetProperty("status_code", out var sc) && sc.ValueKind == JsonValueKind.Number ? sc.GetInt32() : 0;
            if (code == 40200 || code == 40201 || code == 40202)
            {
                logger?.LogError("DataForSEO account has no balance or hit a limit (status {Code}).", code);
                throw new KeywordProviderException("Keyword data is temporarily unavailable. The platform owner has been told.");
            }
            if (code is 40101 or 40100)
                throw new KeywordProviderException("The keyword data service rejected our account. The platform owner has been told to check it.");
            if (code != 20000)
            {
                logger?.LogWarning("DataForSEO task for {Domain} answered {Code}: {Message}", domain, code, task.TryGetProperty("status_message", out var m) ? m.GetString() : "");
                throw new KeywordProviderException("The keyword data service could not return data for that website.");
            }

            var rows = new List<KeywordRow>();
            if (!task.TryGetProperty("result", out var results) || results.ValueKind != JsonValueKind.Array || results.GetArrayLength() == 0) return rows;
            if (!results[0].TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array) return rows;

            foreach (var item in items.EnumerateArray())
            {
                if (!item.TryGetProperty("keyword_data", out var kd)) continue;
                var keyword = kd.TryGetProperty("keyword", out var k) && k.ValueKind == JsonValueKind.String ? k.GetString() : null;
                if (string.IsNullOrWhiteSpace(keyword)) continue;

                var volume = 0;
                if (kd.TryGetProperty("keyword_info", out var ki) && ki.ValueKind == JsonValueKind.Object
                    && ki.TryGetProperty("search_volume", out var sv) && sv.ValueKind == JsonValueKind.Number) volume = sv.GetInt32();

                int? difficulty = null;
                if (kd.TryGetProperty("keyword_properties", out var kp) && kp.ValueKind == JsonValueKind.Object
                    && kp.TryGetProperty("keyword_difficulty", out var kdiff) && kdiff.ValueKind == JsonValueKind.Number) difficulty = kdiff.GetInt32();

                var position = 0; string? url = null;
                if (item.TryGetProperty("ranked_serps_element", out var rse) && rse.ValueKind == JsonValueKind.Object
                    && rse.TryGetProperty("serp_item", out var si) && si.ValueKind == JsonValueKind.Object)
                {
                    if (si.TryGetProperty("rank_group", out var rg) && rg.ValueKind == JsonValueKind.Number) position = rg.GetInt32();
                    if (si.TryGetProperty("url", out var u) && u.ValueKind == JsonValueKind.String) url = u.GetString();
                }
                rows.Add(new KeywordRow(keyword!.Trim().ToLowerInvariant(), volume, difficulty, position, url));
            }
            return rows;
        }
    }
}
