using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Options;

namespace Softaxis.LeadGen.Infrastructure.Services;

public sealed class PaymentException(string message) : Exception(message);

/// <summary>
/// Takes card money for credit packs. Stripe Checkout and PayPal Orders, both over REST with no SDK,
/// like every other integration here. Both are hosted pages — card numbers never touch our servers.
///
/// Credits are added only by <see cref="ICreditFulfilment"/>, and only after the provider says the
/// money arrived (a signed webhook for Stripe, a server-side capture for PayPal). The redirect back
/// to our site is never taken as proof of payment: anyone can type that URL.
/// </summary>
public interface ICreditPayments
{
    bool StripeConfigured { get; }
    bool PayPalConfigured { get; }
    string PublicBaseUrl { get; }
    Task<string> CreateStripeCheckoutAsync(CreditPurchase purchase, Guid tenantId, string successUrl, string cancelUrl, CancellationToken ct);
    Task<string> CreatePayPalOrderAsync(CreditPurchase purchase, string returnUrl, string cancelUrl, CancellationToken ct);
    Task<PayPalCapture> CapturePayPalAsync(string orderId, CancellationToken ct);
    bool VerifyStripeSignature(string payload, string? header);
}

public sealed record PayPalCapture(bool Completed, string? CustomId, long AmountMinor, string? Currency, string? Failure);

internal sealed class CreditPayments(
    IHttpClientFactory http, IOptions<LeadGenOptions> options, IConfiguration config, ILogger<CreditPayments> logger) : ICreditPayments
{
    private LeadGenOptions O => options.Value;

    private string? StripeKey => FirstNonEmpty(O.Stripe.SecretKey, config["Billing:Stripe:SecretKey"]);
    private string? PayPalId => FirstNonEmpty(O.PayPal.ClientId, config["Billing:PayPal:ClientId"]);
    private string? PayPalSecret => FirstNonEmpty(O.PayPal.ClientSecret, config["Billing:PayPal:ClientSecret"]);
    private bool PayPalSandbox => O.PayPal.ClientId is not null ? O.PayPal.UseSandbox : config.GetValue<bool>("Billing:PayPal:UseSandbox");

    public bool StripeConfigured => !string.IsNullOrWhiteSpace(StripeKey);
    public bool PayPalConfigured => !string.IsNullOrWhiteSpace(PayPalId) && !string.IsNullOrWhiteSpace(PayPalSecret);
    public string PublicBaseUrl => (FirstNonEmpty(O.PublicBaseUrl, config["Billing:PublicBaseUrl"]) ?? "http://localhost:5173").TrimEnd('/');

    private static string? FirstNonEmpty(params string?[] values) => values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    // ── Stripe ───────────────────────────────────────────────────────────────────────────────

    public async Task<string> CreateStripeCheckoutAsync(CreditPurchase p, Guid tenantId, string successUrl, string cancelUrl, CancellationToken ct)
    {
        if (!StripeConfigured) throw new PaymentException("Card payments are not set up yet.");

        var form = new Dictionary<string, string>
        {
            ["mode"] = "payment",
            ["success_url"] = successUrl,
            ["cancel_url"] = cancelUrl,
            ["client_reference_id"] = p.Id.ToString(),
            ["metadata[purchase_id]"] = p.Id.ToString(),
            ["metadata[tenant_id]"] = tenantId.ToString(),
            ["payment_intent_data[metadata][purchase_id]"] = p.Id.ToString(),
            ["line_items[0][quantity]"] = "1",
            ["line_items[0][price_data][currency]"] = p.Currency.ToLowerInvariant(),
            ["line_items[0][price_data][unit_amount]"] = p.AmountMinor.ToString(),
            ["line_items[0][price_data][product_data][name]"] = $"Lead Generation credits — {p.PackName}",
            ["line_items[0][price_data][product_data][description]"] = $"{p.Credits:N0} credits",
        };

        using var client = http.CreateClient("leadgen-api");
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.stripe.com/v1/checkout/sessions")
        { Content = new FormUrlEncodedContent(form) };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", StripeKey);
        // The purchase id as an idempotency key: a retried request returns the same session.
        req.Headers.Add("Idempotency-Key", $"leadgen-checkout-{p.Id}");

        using var res = await client.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            logger.LogWarning("Stripe checkout refused: {Status} {Body}", (int)res.StatusCode, Trim(body));
            throw new PaymentException("The card payment could not be started. Please try again.");
        }

        using var doc = JsonDocument.Parse(body);
        var id = doc.RootElement.GetProperty("id").GetString()!;
        var url = doc.RootElement.GetProperty("url").GetString()!;
        p.SetProviderRef(id);
        return url;
    }

    /// <summary>Stripe signs the raw body: "t=timestamp,v1=hmac". Without the secret every webhook is refused.</summary>
    public bool VerifyStripeSignature(string payload, string? header)
    {
        var secret = O.Stripe.WebhookSecret;
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(header)) return false;

        string? t = null; var sigs = new List<string>();
        foreach (var part in header.Split(','))
        {
            var kv = part.Split('=', 2); if (kv.Length != 2) continue;
            if (kv[0].Trim() == "t") t = kv[1].Trim();
            else if (kv[0].Trim() == "v1") sigs.Add(kv[1].Trim());
        }
        if (t is null || sigs.Count == 0 || !long.TryParse(t, out var ts)) return false;
        if (Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - ts) > 300) return false;   // replayed

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{t}.{payload}"));
        foreach (var s in sigs)
        {
            try { if (CryptographicOperations.FixedTimeEquals(expected, Convert.FromHexString(s))) return true; }
            catch (FormatException) { }
        }
        return false;
    }

    // ── PayPal ───────────────────────────────────────────────────────────────────────────────

    private string PayPalBase => PayPalSandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

    private async Task<string> PayPalTokenAsync(HttpClient client, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{PayPalBase}/v1/oauth2/token")
        { Content = new FormUrlEncodedContent(new Dictionary<string, string> { ["grant_type"] = "client_credentials" }) };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{PayPalId}:{PayPalSecret}")));
        using var res = await client.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode) { logger.LogWarning("PayPal sign-in refused: {Status}", (int)res.StatusCode); throw new PaymentException("PayPal could not be reached."); }
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.GetProperty("access_token").GetString()!;
    }

    public async Task<string> CreatePayPalOrderAsync(CreditPurchase p, string returnUrl, string cancelUrl, CancellationToken ct)
    {
        if (!PayPalConfigured) throw new PaymentException("PayPal is not set up yet.");
        using var client = http.CreateClient("leadgen-api");
        var token = await PayPalTokenAsync(client, ct);

        var body = new
        {
            intent = "CAPTURE",
            purchase_units = new[]
            {
                new
                {
                    reference_id = p.Id.ToString(), custom_id = p.Id.ToString(),
                    description = $"Lead Generation credits — {p.PackName} ({p.Credits:N0} credits)",
                    amount = new { currency_code = p.Currency, value = (p.AmountMinor / 100m).ToString("0.00", System.Globalization.CultureInfo.InvariantCulture) },
                },
            },
            payment_source = new { paypal = new { experience_context = new { return_url = returnUrl, cancel_url = cancelUrl, user_action = "PAY_NOW", brand_name = "Vrodux" } } },
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{PayPalBase}/v2/checkout/orders")
        { Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json") };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Headers.Add("PayPal-Request-Id", $"leadgen-order-{p.Id}");

        using var res = await client.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            logger.LogWarning("PayPal order refused: {Status} {Body}", (int)res.StatusCode, Trim(text));
            throw new PaymentException(text.Contains("CURRENCY_NOT_SUPPORTED", StringComparison.OrdinalIgnoreCase)
                ? $"PayPal does not support {p.Currency}. Pay by card instead."
                : "The PayPal payment could not be started. Please try again.");
        }

        using var doc = JsonDocument.Parse(text);
        var id = doc.RootElement.GetProperty("id").GetString()!;
        string? approve = null;
        foreach (var l in doc.RootElement.GetProperty("links").EnumerateArray())
            if (l.GetProperty("rel").GetString() is "payer-action" or "approve") { approve = l.GetProperty("href").GetString(); break; }
        if (approve is null) throw new PaymentException("PayPal did not return a payment page.");
        p.SetProviderRef(id);
        return approve;
    }

    public async Task<PayPalCapture> CapturePayPalAsync(string orderId, CancellationToken ct)
    {
        if (!PayPalConfigured) return new(false, null, 0, null, "PayPal is not set up.");
        using var client = http.CreateClient("leadgen-api");
        var token = await PayPalTokenAsync(client, ct);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{PayPalBase}/v2/checkout/orders/{Uri.EscapeDataString(orderId)}/capture")
        { Content = new StringContent("{}", Encoding.UTF8, "application/json") };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Headers.Add("PayPal-Request-Id", $"leadgen-capture-{orderId}");

        using var res = await client.SendAsync(req, ct);
        var text = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
        {
            // Already captured (a retry or double click) is fine; anything else is a real failure.
            if (text.Contains("ORDER_ALREADY_CAPTURED", StringComparison.OrdinalIgnoreCase)) return await ReadOrderAsync(client, token, orderId, ct);
            logger.LogWarning("PayPal capture refused: {Status} {Body}", (int)res.StatusCode, Trim(text));
            return new(false, null, 0, null, "PayPal did not complete the payment.");
        }
        return ParseCapture(text);
    }

    private async Task<PayPalCapture> ReadOrderAsync(HttpClient client, string token, string orderId, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{PayPalBase}/v2/checkout/orders/{Uri.EscapeDataString(orderId)}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var res = await client.SendAsync(req, ct);
        return res.IsSuccessStatusCode ? ParseCapture(await res.Content.ReadAsStringAsync(ct)) : new(false, null, 0, null, "Could not confirm the payment.");
    }

    private static PayPalCapture ParseCapture(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var status = root.TryGetProperty("status", out var s) ? s.GetString() : null;
        if (status != "COMPLETED") return new(false, null, 0, null, $"Payment status: {status ?? "unknown"}");

        string? custom = null; long minor = 0; string? currency = null;
        if (root.TryGetProperty("purchase_units", out var units) && units.GetArrayLength() > 0)
        {
            var u = units[0];
            custom = u.TryGetProperty("custom_id", out var c) ? c.GetString() : null;
            if (u.TryGetProperty("payments", out var pay) && pay.TryGetProperty("captures", out var caps) && caps.GetArrayLength() > 0)
            {
                var cap = caps[0];
                if (cap.TryGetProperty("amount", out var amt))
                {
                    currency = amt.GetProperty("currency_code").GetString();
                    minor = (long)Math.Round(decimal.Parse(amt.GetProperty("value").GetString()!, System.Globalization.CultureInfo.InvariantCulture) * 100m);
                }
            }
        }
        return new(true, custom, minor, currency, null);
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;
}
