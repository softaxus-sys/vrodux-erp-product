using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Softaxis.Inventory.Application.Abstractions;

namespace Softaxis.Inventory.Infrastructure.Services;

/// <summary>
/// Public product databases, asked from the server so every device gets the same answer and a browser's
/// cross-origin rules or a rate limit on a shop's connection never matter. All hosts are fixed here; a scanned
/// value is only ever a path segment, never a host.
///   - Open Food Facts, Open Beauty Facts, Open Products Facts, Open Pet Food Facts: free, open data, global.
///   - UPCitemdb (trial tier): general merchandise, a small daily allowance, used last.
/// </summary>
public sealed class ProductCatalogueLookup(IHttpClientFactory http, IMemoryCache cache, ILogger<ProductCatalogueLookup> log)
    : IProductCatalogueLookup
{
    public const string ClientName = "product-catalogue";

    private sealed record OpenSource(string Host, string Key, string Label);

    // Order is priority: when two databases know a code, the first one listed wins.
    private static readonly OpenSource[] OpenSources =
    [
        new("world.openfoodfacts.org",      "openfoodfacts",     "Open Food Facts"),
        new("world.openbeautyfacts.org",    "openbeautyfacts",   "Open Beauty Facts"),
        new("world.openproductsfacts.org",  "openproductsfacts", "Open Products Facts"),
        new("world.openpetfoodfacts.org",   "openpetfoodfacts",  "Open Pet Food Facts"),
    ];

    // Remember answers: a shop scans the same item again and again, and the free tiers are small.
    private static readonly TimeSpan Found = TimeSpan.FromHours(24);
    private static readonly TimeSpan Missing = TimeSpan.FromMinutes(30);

    public async Task<ExternalProductInfoDto?> FindAsync(string gtin, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(gtin) || gtin.Any(c => !char.IsDigit(c))) return null;

        var key = "gtin-lookup:" + gtin;
        if (cache.TryGetValue(key, out ExternalProductInfoDto? hit)) return hit;

        ExternalProductInfoDto? result = null;
        try
        {
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
            linked.CancelAfter(TimeSpan.FromSeconds(8));

            var open = await Task.WhenAll(OpenSources.Select(s => FromOpenFactsAsync(s, gtin, linked.Token)));
            result = open.FirstOrDefault(r => r is not null) ?? await FromUpcItemDbAsync(gtin, linked.Token);
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            log.LogWarning(e, "Product database lookup failed for {Code}", gtin);
        }

        // An outage must not be remembered as "this product does not exist".
        if (result is not null) cache.Set(key, result, Found);
        return result;
    }

    private async Task<ExternalProductInfoDto?> FromOpenFactsAsync(OpenSource source, string gtin, CancellationToken ct)
    {
        try
        {
            var client = http.CreateClient(ClientName);
            var url = $"https://{source.Host}/api/v2/product/{Uri.EscapeDataString(gtin)}.json" +
                      "?fields=product_name,product_name_en,generic_name,brands,categories,quantity,image_front_url,image_url";
            using var res = await client.GetAsync(url, ct);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadFromJsonAsync<OpenFactsResponse>(cancellationToken: ct);
            var p = body?.Product;
            if (body is null || body.Status != 1 || p is null) return null;

            var name = Clean(p.ProductNameEn) ?? Clean(p.ProductName) ?? Clean(p.GenericName);
            if (name is null) return null;

            var generic = Clean(p.GenericName);
            return new ExternalProductInfoDto(
                gtin, name, FirstOf(p.Brands), generic is not null && generic != name ? generic : null,
                FirstOf(p.Categories), Clean(p.Quantity), Clean(p.ImageFrontUrl) ?? Clean(p.ImageUrl),
                source.Key, source.Label);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogDebug(e, "{Source} unavailable for {Code}", source.Key, gtin);
            return null;
        }
    }

    private async Task<ExternalProductInfoDto?> FromUpcItemDbAsync(string gtin, CancellationToken ct)
    {
        try
        {
            var client = http.CreateClient(ClientName);
            using var res = await client.GetAsync($"https://api.upcitemdb.com/prod/trial/lookup?upc={Uri.EscapeDataString(gtin)}", ct);
            if (!res.IsSuccessStatusCode) return null;

            var body = await res.Content.ReadFromJsonAsync<UpcResponse>(cancellationToken: ct);
            var item = body?.Items?.FirstOrDefault();
            var title = Clean(item?.Title);
            if (item is null || title is null) return null;

            return new ExternalProductInfoDto(
                gtin, title, Clean(item.Brand), Clean(item.Description), FirstOf(item.Category),
                Clean(item.Size), item.Images?.FirstOrDefault(i => i.StartsWith("https://", StringComparison.OrdinalIgnoreCase)),
                "upcitemdb", "UPCitemdb");
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            log.LogDebug(e, "UPCitemdb unavailable for {Code}", gtin);
            return null;
        }
    }

    private static string? Clean(string? s)
    {
        var t = s?.Trim();
        return string.IsNullOrEmpty(t) ? null : (t.Length > 300 ? t[..300] : t);
    }

    /// <summary>Brand and category fields arrive as "A, B, C"; the first is the useful one.</summary>
    private static string? FirstOf(string? s)
        => Clean(s?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault());

    private sealed class OpenFactsResponse
    {
        [JsonPropertyName("status")]  public int Status { get; set; }
        [JsonPropertyName("product")] public OpenFactsProduct? Product { get; set; }
    }

    private sealed class OpenFactsProduct
    {
        [JsonPropertyName("product_name")]     public string? ProductName { get; set; }
        [JsonPropertyName("product_name_en")]  public string? ProductNameEn { get; set; }
        [JsonPropertyName("generic_name")]     public string? GenericName { get; set; }
        [JsonPropertyName("brands")]           public string? Brands { get; set; }
        [JsonPropertyName("categories")]       public string? Categories { get; set; }
        [JsonPropertyName("quantity")]         public string? Quantity { get; set; }
        [JsonPropertyName("image_front_url")]  public string? ImageFrontUrl { get; set; }
        [JsonPropertyName("image_url")]        public string? ImageUrl { get; set; }
    }

    private sealed class UpcResponse
    {
        [JsonPropertyName("items")] public List<UpcItem>? Items { get; set; }
    }

    private sealed class UpcItem
    {
        [JsonPropertyName("title")]       public string? Title { get; set; }
        [JsonPropertyName("brand")]       public string? Brand { get; set; }
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("category")]    public string? Category { get; set; }
        [JsonPropertyName("size")]        public string? Size { get; set; }
        [JsonPropertyName("images")]      public List<string>? Images { get; set; }
    }
}
