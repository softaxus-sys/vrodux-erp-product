using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Softaxis.Restaurant.Infrastructure.Platforms;

/// <summary>The parts of a Foodpanda (Delivery Hero) order we use.</summary>
public sealed record FoodpandaOrder(
    string Token, string? Code, bool IsTest, string ExpeditionType, string? CustomerName, string? CustomerPhone,
    string? Address, string? Comment, string? PaymentType, IReadOnlyList<FoodpandaLine> Lines);

/// <summary>One product line. <see cref="GrossTotal"/> is what the customer paid for the whole line,
/// tax included; <see cref="Options"/> are the chosen toppings, already priced into it.</summary>
public sealed record FoodpandaLine(string Name, string? RemoteCode, int Quantity, decimal GrossTotal, IReadOnlyList<string> Options, string? Comment);

public static class FoodpandaOrderParser
{
    /// <summary>Returns null with a reason when the body is not an order we can take.</summary>
    public static (FoodpandaOrder? Order, string? Error) Parse(string body)
    {
        JsonDocument doc;
        try { doc = JsonDocument.Parse(body); } catch (JsonException) { return (null, "The order is not valid JSON."); }
        using (doc)
        {
            var r = doc.RootElement;
            var token = Str(r, "token");
            if (string.IsNullOrWhiteSpace(token)) return (null, "The order has no token.");

            var lines = new List<FoodpandaLine>();
            if (r.TryGetProperty("products", out var products) && products.ValueKind == JsonValueKind.Array)
            {
                foreach (var p in products.EnumerateArray())
                {
                    var qty = Math.Max(1, (int)Math.Round(Num(p, "quantity") ?? 1));
                    var unit = Num(p, "unitPrice") ?? 0;
                    var options = new List<string>();
                    decimal toppings = 0;
                    if (p.TryGetProperty("selectedToppings", out var tops) && tops.ValueKind == JsonValueKind.Array)
                        Toppings(tops, options, ref toppings, 0);
                    var paid = Num(p, "paidPrice");
                    var gross = paid is > 0 ? paid.Value : (unit + toppings) * qty;
                    lines.Add(new FoodpandaLine(Str(p, "name") ?? "Item", Str(p, "remoteCode"), qty, gross, options, Str(p, "comment")));
                }
            }
            if (lines.Count == 0) return (null, "The order has no products.");

            string? name = null, phone = null, address = null;
            if (r.TryGetProperty("customer", out var c) && c.ValueKind == JsonValueKind.Object)
            {
                name = string.Join(' ', new[] { Str(c, "firstName"), Str(c, "lastName") }.Where(s => !string.IsNullOrWhiteSpace(s)));
                phone = Str(c, "mobilePhone") ?? Str(c, "phone");
            }
            if (r.TryGetProperty("delivery", out var d) && d.ValueKind == JsonValueKind.Object
                && d.TryGetProperty("address", out var a) && a.ValueKind == JsonValueKind.Object)
            {
                address = string.Join(", ", a.EnumerateObject()
                    .Where(x => x.Value.ValueKind is JsonValueKind.String or JsonValueKind.Number
                             && x.Name is not ("latitude" or "longitude" or "postcode"))
                    .Select(x => x.Value.ToString().Trim()).Where(s => s.Length > 0));
            }
            string? comment = null;
            if (r.TryGetProperty("comments", out var cm) && cm.ValueKind == JsonValueKind.Object) comment = Str(cm, "customerComment");
            string? payment = null;
            if (r.TryGetProperty("payment", out var pay) && pay.ValueKind == JsonValueKind.Object) payment = Str(pay, "type");

            var isTest = r.TryGetProperty("test", out var t) && t.ValueKind == JsonValueKind.True;
            return (new FoodpandaOrder(token!, Str(r, "code"), isTest, Str(r, "expeditionType") ?? "delivery",
                string.IsNullOrWhiteSpace(name) ? null : name, phone, string.IsNullOrWhiteSpace(address) ? null : address,
                comment, payment, lines), null);
        }
    }

    private static void Toppings(JsonElement arr, List<string> names, ref decimal total, int depth)
    {
        foreach (var t in arr.EnumerateArray())
        {
            var q = Num(t, "quantity") ?? 1;
            var n = Str(t, "name");
            if (!string.IsNullOrWhiteSpace(n)) names.Add(q > 1 ? $"{q:0} x {n}" : n!);
            total += (Num(t, "price") ?? 0) * q;
            if (depth < 3 && t.TryGetProperty("children", out var ch) && ch.ValueKind == JsonValueKind.Array)
                Toppings(ch, names, ref total, depth + 1);
        }
    }

    public static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) ? v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        } : null;

    /// <summary>Foodpanda sends amounts as numbers or as strings ("8.50").</summary>
    public static decimal? Num(JsonElement e, string name)
    {
        if (!e.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d;
        if (v.ValueKind == JsonValueKind.String
            && decimal.TryParse(v.GetString(), NumberStyles.Number, CultureInfo.InvariantCulture, out var s)) return s;
        return null;
    }

    /// <summary>
    /// Foodpanda authenticates its calls with the plugin secret: either sent as-is, or as a JWT
    /// signed with it (HS256/HS512). With no secret saved only sandbox calls are taken.
    /// </summary>
    public static bool IsAuthorized(string? secret, string environment, string? authorization)
    {
        if (string.IsNullOrEmpty(secret)) return environment == "sandbox";
        var presented = authorization?.Trim() ?? "";
        if (presented.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) presented = presented[7..].Trim();
        if (presented.Length == 0) return false;
        if (Equal(presented, secret)) return true;

        var parts = presented.Split('.');
        if (parts.Length != 3) return false;
        try
        {
            using var header = JsonDocument.Parse(B64(parts[0]));
            var alg = Str(header.RootElement, "alg");
            var key = Encoding.UTF8.GetBytes(secret);
            var data = Encoding.ASCII.GetBytes($"{parts[0]}.{parts[1]}");
            byte[] sig = alg switch
            {
                "HS512" => HMACSHA512.HashData(key, data),
                "HS256" => HMACSHA256.HashData(key, data),
                _ => [],
            };
            if (sig.Length == 0 || !CryptographicOperations.FixedTimeEquals(sig, B64(parts[2]))) return false;
            using var payload = JsonDocument.Parse(B64(parts[1]));
            return !(payload.RootElement.TryGetProperty("exp", out var exp) && exp.TryGetInt64(out var e)
                     && DateTimeOffset.FromUnixTimeSeconds(e) < DateTimeOffset.UtcNow.AddMinutes(-2));
        }
        catch { return false; }
    }

    private static bool Equal(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));

    private static byte[] B64(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
