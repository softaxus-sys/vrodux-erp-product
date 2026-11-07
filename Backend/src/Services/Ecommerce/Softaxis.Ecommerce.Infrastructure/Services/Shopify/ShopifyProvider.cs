using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Softaxis.Ecommerce.Application.Abstractions;

namespace Softaxis.Ecommerce.Infrastructure.Services.Shopify;

/// <summary>
/// Shopify Admin REST API, authenticated with the access token of a custom app the shop owner creates
/// (<c>Settings → Apps and sales channels → Develop apps</c>). The scopes it needs:
/// <c>read/write_products</c>, <c>read/write_inventory</c>, <c>read_locations</c>, <c>read_orders</c>
/// (and <c>read_all_orders</c> for history older than 60 days).
///
/// <para>
/// <b>Shop address is validated before any request.</b> The shop domain is typed by a user and becomes the host of an
/// outbound request, so only <c>*.myshopify.com</c> is accepted — otherwise this would be a way to make the server call
/// any address. <c>Ecommerce:ShopifyBaseUrl</c> replaces the host for tests only.
/// </para>
/// </summary>
internal sealed partial class ShopifyProvider(IHttpClientFactory httpFactory, IConfiguration configuration) : IChannelProvider
{
    public const string HttpClientName = "shopify";
    public string Kind => "shopify";

    private string ApiVersion => configuration["Ecommerce:ShopifyApiVersion"] ?? "2025-10";

    [GeneratedRegex(@"^[a-z0-9][a-z0-9\-]*\.myshopify\.com$", RegexOptions.IgnoreCase)]
    private static partial Regex ShopDomainPattern();

    public static bool IsValidShopDomain(string? domain) => !string.IsNullOrWhiteSpace(domain) && ShopDomainPattern().IsMatch(domain.Trim());

    // ── Shop ──────────────────────────────────────────────────────────────────

    public async Task<ShopInfo> VerifyAsync(ChannelCredentials c, CancellationToken ct)
    {
        var json = await SendAsync(c, HttpMethod.Get, "shop.json", null, ct);
        var shop = json.GetProperty("shop");
        return new ShopInfo(
            shop.GetProperty("name").GetString() ?? c.ShopDomain,
            shop.TryGetProperty("myshopify_domain", out var d) ? d.GetString() ?? c.ShopDomain : c.ShopDomain,
            shop.TryGetProperty("currency", out var cur) ? cur.GetString() : null,
            shop.TryGetProperty("plan_display_name", out var plan) ? plan.GetString() : null);
    }

    public async Task<IReadOnlyList<ChannelLocation>> GetLocationsAsync(ChannelCredentials c, CancellationToken ct)
    {
        var json = await SendAsync(c, HttpMethod.Get, "locations.json", null, ct);
        var list = new List<ChannelLocation>();
        foreach (var l in json.GetProperty("locations").EnumerateArray())
            list.Add(new ChannelLocation(
                l.GetProperty("id").GetRawText(),
                l.GetProperty("name").GetString() ?? "Location",
                !l.TryGetProperty("active", out var a) || a.ValueKind != JsonValueKind.False));
        return list;
    }

    // ── Products ──────────────────────────────────────────────────────────────

    public async Task<PushedProduct> UpsertProductAsync(ChannelCredentials c, ProductPush product, string? externalProductId, CancellationToken ct)
    {
        var body = ShopifyMapper.BuildProduct(product, externalProductId);
        var json = externalProductId is null
            ? await SendAsync(c, HttpMethod.Post, "products.json", body.ToJsonString(), ct)
            : await SendAsync(c, HttpMethod.Put, $"products/{externalProductId}.json", body.ToJsonString(), ct);

        return ShopifyMapper.ParseProduct(json.GetProperty("product"), product.Variants);
    }

    public async Task SetProductActiveAsync(ChannelCredentials c, string externalProductId, bool active, CancellationToken ct)
    {
        var body = $"{{\"product\":{{\"id\":{externalProductId},\"status\":\"{(active ? "active" : "draft")}\"}}}}";
        await SendAsync(c, HttpMethod.Put, $"products/{externalProductId}.json", body, ct);
    }

    public async Task DeleteProductAsync(ChannelCredentials c, string externalProductId, CancellationToken ct)
    {
        try { await SendAsync(c, HttpMethod.Delete, $"products/{externalProductId}.json", null, ct); }
        catch (ChannelException ex) when (ex.Message.Contains("404")) { /* already gone: the end state is the same */ }
    }

    // ── Stock ─────────────────────────────────────────────────────────────────

    public async Task SetInventoryAsync(ChannelCredentials c, string locationId, string inventoryItemId, int available, CancellationToken ct)
    {
        var body = $"{{\"location_id\":{locationId},\"inventory_item_id\":{inventoryItemId},\"available\":{available}}}";
        try
        {
            await SendAsync(c, HttpMethod.Post, "inventory_levels/set.json", body, ct);
        }
        catch (ChannelException ex) when (ex.Failure == ChannelFailure.ItemRejected)
        {
            // A new variant is only stocked at the shop's default location. Stock it at ours, then set the level.
            var connect = $"{{\"location_id\":{locationId},\"inventory_item_id\":{inventoryItemId}}}";
            await SendAsync(c, HttpMethod.Post, "inventory_levels/connect.json", connect, ct);
            await SendAsync(c, HttpMethod.Post, "inventory_levels/set.json", body, ct);
        }
    }

    public async Task AdjustInventoryAsync(ChannelCredentials c, string locationId, string inventoryItemId, int delta, CancellationToken ct)
    {
        var body = $"{{\"location_id\":{locationId},\"inventory_item_id\":{inventoryItemId},\"available_adjustment\":{delta}}}";
        await SendAsync(c, HttpMethod.Post, "inventory_levels/adjust.json", body, ct);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<ExternalOrder>> FetchOrdersAsync(ChannelCredentials c, DateTime? updatedSince, CancellationToken ct)
    {
        var all = new List<ExternalOrder>();
        var path = "orders.json?status=any&limit=250" +
                   (updatedSince is { } since ? "&updated_at_min=" + Uri.EscapeDataString(since.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")) : "");

        // Pages are linked by an opaque cursor in the Link header; the follow-up request carries only that cursor.
        for (var page = 0; page < 40 && path is not null; page++)
        {
            var (json, next) = await SendWithLinkAsync(c, HttpMethod.Get, path, null, ct);
            all.AddRange(ShopifyMapper.ParseOrders(json));
            path = next;
        }
        return all.OrderBy(o => o.UpdatedAt).ToList();
    }

    // ── HTTP ──────────────────────────────────────────────────────────────────

    private async Task<JsonElement> SendAsync(ChannelCredentials c, HttpMethod method, string path, string? body, CancellationToken ct)
        => (await SendWithLinkAsync(c, method, path, body, ct)).Json;

    private async Task<(JsonElement Json, string? Next)> SendWithLinkAsync(
        ChannelCredentials c, HttpMethod method, string path, string? body, CancellationToken ct)
    {
        var baseUrl = configuration["Ecommerce:ShopifyBaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            if (!IsValidShopDomain(c.ShopDomain))
                throw new ChannelException("The shop address must look like your-shop.myshopify.com.", ChannelFailure.Permanent);
            baseUrl = "https://" + c.ShopDomain.Trim().ToLowerInvariant();
        }

        var url = $"{baseUrl.TrimEnd('/')}/admin/api/{ApiVersion}/{path.TrimStart('/')}";
        var http = httpFactory.CreateClient(HttpClientName);

        for (var attempt = 1; ; attempt++)
        {
            using var req = new HttpRequestMessage(method, url);
            req.Headers.Add("X-Shopify-Access-Token", c.Token);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            if (body is not null) req.Content = new StringContent(body, Encoding.UTF8, "application/json");

            HttpResponseMessage res;
            try
            {
                res = await http.SendAsync(req, ct);
            }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested)
            {
                throw new ChannelException("The shop did not answer in time.", ChannelFailure.Transient);
            }
            catch (HttpRequestException ex)
            {
                throw new ChannelException("Could not reach the shop: " + ex.Message, ChannelFailure.Transient);
            }

            using (res)
            {
                var text = await res.Content.ReadAsStringAsync(ct);

                // Shopify limits request rate; it says how long to wait. Honour it a few times, then give up for now.
                if (res.StatusCode == HttpStatusCode.TooManyRequests && attempt < 4)
                {
                    var wait = res.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(2);
                    await Task.Delay(wait > TimeSpan.FromSeconds(20) ? TimeSpan.FromSeconds(20) : wait, ct);
                    continue;
                }

                if (!res.IsSuccessStatusCode) throw Classify(res.StatusCode, text, method, path);

                // Close to the bucket limit: pause briefly so the next call is not refused.
                if (res.Headers.TryGetValues("X-Shopify-Shop-Api-Call-Limit", out var limit) && IsNearLimit(limit.FirstOrDefault()))
                    await Task.Delay(600, ct);

                string? next = null;
                if (res.Headers.TryGetValues("Link", out var links)) next = NextLink(links);

                if (string.IsNullOrWhiteSpace(text)) return (JsonDocument.Parse("{}").RootElement.Clone(), next);
                return (JsonDocument.Parse(text).RootElement.Clone(), next);
            }
        }
    }

    private static bool IsNearLimit(string? header)
    {
        // "32/40": calls used of the bucket.
        var parts = header?.Split('/');
        return parts is { Length: 2 } && int.TryParse(parts[0], out var used) && int.TryParse(parts[1], out var cap) && cap > 0 && used >= cap - 4;
    }

    /// <summary>The path-and-query of the <c>rel="next"</c> page, relative to the API root, or null on the last page.</summary>
    internal static string? NextLink(IEnumerable<string> linkHeaders)
    {
        foreach (var header in linkHeaders)
        {
            foreach (var part in header.Split(','))
            {
                if (!part.Contains("rel=\"next\"", StringComparison.OrdinalIgnoreCase)) continue;
                var start = part.IndexOf('<'); var end = part.IndexOf('>');
                if (start < 0 || end <= start) continue;
                var uri = part[(start + 1)..end];
                var marker = "/admin/api/";
                var i = uri.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (i < 0) continue;
                var rest = uri[(i + marker.Length)..];
                var slash = rest.IndexOf('/');
                return slash < 0 ? null : rest[(slash + 1)..];   // drop the version segment
            }
        }
        return null;
    }

    private static ChannelException Classify(HttpStatusCode status, string body, HttpMethod method, string path)
    {
        var detail = ExtractErrors(body);
        var what = $"{method.Method} {path.Split('?')[0]} -> {(int)status}";

        return status switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.PaymentRequired
                => new ChannelException("Shopify refused the access token. Create a new one in the shop's custom app and reconnect." + Suffix(detail), ChannelFailure.Permanent),
            HttpStatusCode.Forbidden
                => new ChannelException("The access token lacks a permission this needs (products, inventory, locations or orders)." + Suffix(detail), ChannelFailure.Permanent),
            HttpStatusCode.NotFound
                => new ChannelException($"Not found in the shop ({what})." + Suffix(detail), ChannelFailure.ItemRejected),
            HttpStatusCode.UnprocessableEntity or HttpStatusCode.BadRequest
                => new ChannelException(Suffix(detail, "The shop refused it") + $" ({what})", ChannelFailure.ItemRejected),
            _ when (int)status >= 500
                => new ChannelException($"Shopify is having trouble ({what}).", ChannelFailure.Transient),
            _ => new ChannelException($"Shopify answered {(int)status} ({what})." + Suffix(detail), ChannelFailure.Transient),
        };

        static string Suffix(string? d, string prefix = "") =>
            string.IsNullOrWhiteSpace(d) ? prefix : (prefix.Length > 0 ? prefix + ": " : " ") + d;
    }

    /// <summary>Shopify reports problems as <c>{"errors": "text"}</c> or <c>{"errors": {"field": ["text"]}}</c>.</summary>
    internal static string? ExtractErrors(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("errors", out var e)) return null;
            if (e.ValueKind == JsonValueKind.String) return e.GetString();
            if (e.ValueKind == JsonValueKind.Object)
            {
                var parts = new List<string>();
                foreach (var p in e.EnumerateObject())
                {
                    var msgs = p.Value.ValueKind == JsonValueKind.Array
                        ? string.Join(", ", p.Value.EnumerateArray().Select(x => x.ToString()))
                        : p.Value.ToString();
                    parts.Add($"{p.Name} {msgs}");
                }
                return string.Join("; ", parts);
            }
            return e.ToString();
        }
        catch (JsonException) { return null; }
    }
}
