using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.LeadGen.Infrastructure.Options;

namespace Softaxis.LeadGen.Infrastructure.Providers;

public sealed record PlaceResult(
    string Id, string Name, string? Address, string? Region, string? City, string? Area, double? Lat, double? Lng,
    string? Phone, string? InternationalPhone, string? Website, decimal? Rating, int? ReviewCount, string? BusinessStatus,
    string? PrimaryType, string? PrimaryTypeLabel, string? MapsUri, string? CountryName);

public sealed record PlacesPage(IReadOnlyList<PlaceResult> Places, string? NextPageToken);

public sealed class PlacesException(HttpStatusCode status, string message, bool fatal) : Exception(message)
{
    public HttpStatusCode Status { get; } = status;
    /// <summary>The key or quota is the problem: every further request will fail the same way.</summary>
    public bool Fatal { get; } = fatal;
}

/// <summary>
/// Google Places API (New) — Text Search. Thin, hand-rolled client like every other integration in
/// this codebase (no SDK). It asks for exactly the fields the product uses; each extra field moves
/// the request into a more expensive billing tier, so the mask is deliberate, not "everything".
/// </summary>
public interface IPlacesClient
{
    bool IsConfigured { get; }
    Task<PlacesPage> SearchTextAsync(string query, string regionCode, double? biasLat, double? biasLng, int biasRadiusMeters,
        string? pageToken, CancellationToken ct);
}

internal sealed class GooglePlacesClient(
    IHttpClientFactory http, IOptions<LeadGenOptions> options, ILogger<GooglePlacesClient> logger) : IPlacesClient
{
    private const string Endpoint = "https://places.googleapis.com/v1/places:searchText";
    private const string FieldMask =
        "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location," +
        "places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating," +
        "places.userRatingCount,places.businessStatus,places.primaryType,places.primaryTypeDisplayName," +
        "places.googleMapsUri,nextPageToken";

    public bool IsConfigured => options.Value.GooglePlaces.IsConfigured;

    public async Task<PlacesPage> SearchTextAsync(string query, string regionCode, double? biasLat, double? biasLng,
        int biasRadiusMeters, string? pageToken, CancellationToken ct)
    {
        if (!IsConfigured) throw new PlacesException(HttpStatusCode.ServiceUnavailable, "Business search is not configured on this server.", fatal: true);

        var body = new Dictionary<string, object?>
        {
            ["textQuery"] = query, ["languageCode"] = "en", ["regionCode"] = regionCode, ["pageSize"] = 20,
        };
        if (!string.IsNullOrEmpty(pageToken)) body["pageToken"] = pageToken;
        if (biasLat is not null && biasLng is not null)
            body["locationBias"] = new { circle = new { center = new { latitude = biasLat, longitude = biasLng }, radius = (double)biasRadiusMeters } };

        for (var attempt = 0; ; attempt++)
        {
            using var client = http.CreateClient("leadgen-api");
            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
            };
            req.Headers.Add("X-Goog-Api-Key", options.Value.GooglePlaces.ApiKey);
            req.Headers.Add("X-Goog-FieldMask", FieldMask);

            using var res = await client.SendAsync(req, ct);
            var text = await res.Content.ReadAsStringAsync(ct);

            if (res.StatusCode == HttpStatusCode.TooManyRequests && attempt < 2)
            {
                await Task.Delay(TimeSpan.FromSeconds(2 * (attempt + 1)), ct);
                continue;
            }
            if (!res.IsSuccessStatusCode) throw ToException(res.StatusCode, text);
            return Parse(text);
        }
    }

    private PlacesException ToException(HttpStatusCode status, string body)
    {
        var message = $"The business data provider refused the request ({(int)status}).";
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var e) && e.TryGetProperty("message", out var m) && m.GetString() is { Length: > 0 } s)
                message = s.Length > 300 ? s[..300] : s;
        }
        catch (JsonException) { }

        // Key rejected, API not enabled, billing off, quota exhausted: nothing a retry can fix.
        var fatal = status is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.TooManyRequests
                    || (status == HttpStatusCode.BadRequest && message.Contains("API key", StringComparison.OrdinalIgnoreCase));
        logger.LogWarning("Places request failed: {Status} {Message}", (int)status, message);
        return new PlacesException(status, message, fatal);
    }

    private static PlacesPage Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var list = new List<PlaceResult>();
        if (root.TryGetProperty("places", out var places))
            foreach (var p in places.EnumerateArray())
            {
                var id = Str(p, "id"); var name = p.TryGetProperty("displayName", out var dn) ? Str(dn, "text") : null;
                if (id is null || string.IsNullOrWhiteSpace(name)) continue;

                string? region = null, city = null, area = null, country = null;
                if (p.TryGetProperty("addressComponents", out var comps))
                    foreach (var c in comps.EnumerateArray())
                    {
                        var types = c.TryGetProperty("types", out var t) ? t.EnumerateArray().Select(x => x.GetString()).ToList() : [];
                        var text = Str(c, "longText");
                        if (types.Contains("administrative_area_level_1")) region = text;
                        else if (types.Contains("locality")) city = text;
                        else if (types.Contains("sublocality_level_1") || types.Contains("sublocality") || types.Contains("neighborhood")) area ??= text;
                        else if (types.Contains("country")) country = text;
                    }

                double? lat = null, lng = null;
                if (p.TryGetProperty("location", out var loc)) { lat = Dbl(loc, "latitude"); lng = Dbl(loc, "longitude"); }

                list.Add(new PlaceResult(
                    id, name!, Str(p, "formattedAddress"), region, city, area, lat, lng,
                    Str(p, "nationalPhoneNumber"), Str(p, "internationalPhoneNumber"), Str(p, "websiteUri"),
                    Dbl(p, "rating") is { } r ? (decimal)Math.Round(r, 2) : null,
                    p.TryGetProperty("userRatingCount", out var rc) && rc.TryGetInt32(out var n) ? n : null,
                    Str(p, "businessStatus"), Str(p, "primaryType"),
                    p.TryGetProperty("primaryTypeDisplayName", out var pt) ? Str(pt, "text") : null,
                    Str(p, "googleMapsUri"), country));
            }

        return new PlacesPage(list, Str(root, "nextPageToken"));
    }

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static double? Dbl(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;
}
