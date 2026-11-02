using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Softaxis.Ecommerce.Application.Abstractions;

namespace Softaxis.Ecommerce.Infrastructure.Services.Shopify;

/// <summary>
/// Pure translation between our product model and Shopify's Admin REST JSON. Kept apart from the HTTP code so
/// the shapes can be unit-tested without a store.
/// </summary>
internal static class ShopifyMapper
{
    /// <summary>The option value Shopify gives the single variant of a product that has no options.</summary>
    public const string DefaultOptionValue = "Default Title";

    public static JsonObject BuildProduct(ProductPush p, string? existingProductId)
    {
        var product = new JsonObject
        {
            ["title"]        = p.Title,
            ["body_html"]    = p.BodyHtml ?? "",
            ["vendor"]       = p.Vendor ?? "",
            ["product_type"] = p.ProductType ?? "",
            ["tags"]         = p.Tags ?? "",
            ["handle"]       = p.Handle,
            ["status"]       = p.Active ? "active" : "draft",
        };
        if (existingProductId is not null && long.TryParse(existingProductId, out var id)) product["id"] = id;

        if (p.OptionNames.Count > 0)
        {
            var options = new JsonArray();
            foreach (var name in p.OptionNames.Take(3)) options.Add(new JsonObject { ["name"] = name });
            product["options"] = options;
        }

        var variants = new JsonArray();
        foreach (var v in p.Variants) variants.Add(BuildVariant(v, p.OptionNames.Count));
        product["variants"] = variants;

        if (p.Images is not null)
        {
            var images = new JsonArray();
            var position = 1;
            foreach (var img in p.Images)
            {
                images.Add(new JsonObject
                {
                    ["attachment"] = Convert.ToBase64String(img.Data),
                    ["filename"]   = img.FileName,
                    ["alt"]        = img.Alt ?? "",
                    ["position"]   = position++,
                });
            }
            product["images"] = images;
        }

        // The search-engine title and description are fields of the Shopify product itself.
        if (!string.IsNullOrWhiteSpace(p.SeoTitle)) product["metafields_global_title_tag"] = p.SeoTitle;
        if (!string.IsNullOrWhiteSpace(p.MetaDescription)) product["metafields_global_description_tag"] = p.MetaDescription;

        return new JsonObject { ["product"] = product };
    }

    private static JsonObject BuildVariant(ProductPushVariant v, int optionCount)
    {
        var o = new JsonObject
        {
            ["price"]               = v.Price.ToString("0.00", CultureInfo.InvariantCulture),
            ["inventory_management"] = v.TrackInventory ? "shopify" : null,
            // Never oversell: the store refuses an order once the stock we pushed is gone.
            ["inventory_policy"]    = "deny",
            ["requires_shipping"]   = true,
            ["taxable"]             = true,
        };
        if (!string.IsNullOrWhiteSpace(v.Sku)) o["sku"] = v.Sku;
        if (!string.IsNullOrWhiteSpace(v.Barcode)) o["barcode"] = v.Barcode;
        if (v.WeightGrams is > 0) { o["weight"] = v.WeightGrams; o["weight_unit"] = "g"; }
        if (long.TryParse(v.ExternalVariantId, out var vid)) o["id"] = vid;

        for (var i = 0; i < Math.Min(optionCount, 3) && i < v.OptionValues.Count; i++)
            o[$"option{i + 1}"] = v.OptionValues[i];

        return o;
    }

    /// <summary>
    /// Matches the variants Shopify returned to ours. By id when we already knew it, otherwise by the option
    /// values (unique per variant within a product, which Shopify enforces).
    /// </summary>
    public static PushedProduct ParseProduct(JsonElement product, IReadOnlyList<ProductPushVariant> sent)
    {
        var externalId = product.GetProperty("id").GetRawText().Trim('"');
        var handle = product.TryGetProperty("handle", out var h) ? h.GetString() : null;

        var bySignature = new Dictionary<string, ProductPushVariant>(StringComparer.OrdinalIgnoreCase);
        foreach (var v in sent) bySignature[Signature(v.OptionValues)] = v;
        var byId = sent.Where(v => !string.IsNullOrEmpty(v.ExternalVariantId)).ToDictionary(v => v.ExternalVariantId!, v => v);

        var result = new List<PushedVariant>();
        if (product.TryGetProperty("variants", out var variants))
        {
            foreach (var rv in variants.EnumerateArray())
            {
                var vid = rv.GetProperty("id").GetRawText().Trim('"');
                var inv = rv.TryGetProperty("inventory_item_id", out var ii) && ii.ValueKind != JsonValueKind.Null ? ii.GetRawText().Trim('"') : null;
                var sku = rv.TryGetProperty("sku", out var s) && s.ValueKind == JsonValueKind.String ? s.GetString() : null;

                var values = new List<string>();
                for (var i = 1; i <= 3; i++)
                    if (rv.TryGetProperty($"option{i}", out var ov) && ov.ValueKind == JsonValueKind.String) values.Add(ov.GetString()!);

                if (!byId.TryGetValue(vid, out var ours) && !bySignature.TryGetValue(Signature(values), out ours))
                {
                    // A product with no options: Shopify names its only variant "Default Title".
                    if (sent.Count == 1 && sent[0].OptionValues.Count == 0) ours = sent[0];
                    else continue;
                }
                result.Add(new PushedVariant(ours.ProductId, vid, inv, sku));
            }
        }
        return new PushedProduct(externalId, handle, result);
    }

    private static string Signature(IReadOnlyList<string> values) =>
        string.Join("\u001f", values.Select(v => v.Trim()));

    public static IReadOnlyList<ExternalOrder> ParseOrders(JsonElement root)
    {
        var list = new List<ExternalOrder>();
        if (!root.TryGetProperty("orders", out var orders)) return list;

        foreach (var o in orders.EnumerateArray())
        {
            var lines = new List<ExternalOrderLine>();
            if (o.TryGetProperty("line_items", out var items))
            {
                foreach (var li in items.EnumerateArray())
                {
                    lines.Add(new ExternalOrderLine(
                        Str(li, "variant_id"), Str(li, "sku"), Str(li, "title") ?? "Item",
                        Dec(li, "quantity"), Dec(li, "price")));
                }
            }

            string? customer = null;
            if (o.TryGetProperty("customer", out var c) && c.ValueKind == JsonValueKind.Object)
                customer = $"{Str(c, "first_name")} {Str(c, "last_name")}".Trim();
            if (string.IsNullOrWhiteSpace(customer)) customer = null;

            list.Add(new ExternalOrder(
                Str(o, "id")!, Str(o, "name") ?? "#" + Str(o, "order_number"),
                Str(o, "email"), customer,
                Date(o, "created_at") ?? DateTime.UtcNow, Date(o, "updated_at") ?? DateTime.UtcNow, Date(o, "cancelled_at"),
                Str(o, "financial_status"), Str(o, "fulfillment_status"),
                Dec(o, "total_price"), Str(o, "currency"), lines));
        }
        return list;
    }

    private static string? Str(JsonElement e, string name)
    {
        if (!e.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        };
    }

    private static decimal Dec(JsonElement e, string name)
    {
        var s = Str(e, name);
        return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;
    }

    private static DateTime? Date(JsonElement e, string name)
    {
        var s = Str(e, name);
        return DateTimeOffset.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d) ? d.UtcDateTime : null;
    }
}
