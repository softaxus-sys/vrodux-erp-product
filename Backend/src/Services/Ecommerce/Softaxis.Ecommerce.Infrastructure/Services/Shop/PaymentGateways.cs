using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.Ecommerce.Domain.Entities;

namespace Softaxis.Ecommerce.Infrastructure.Services.Shop;

/// <summary>A payment provider refused or could not be reached. The message is safe to show the shopper.</summary>
internal sealed class PaymentException(string message, bool transient = false) : Exception(message)
{
    public bool Transient { get; } = transient;
}

internal sealed record StripeSessionInfo(string Id, string Status, string PaymentStatus, long? AmountTotal, string? Currency, string? PaymentIntent);
internal sealed record PayPalCaptureInfo(string Status, long AmountMinor, string Currency, string? CaptureId);

/// <summary>
/// Stripe over its REST API with the store owner's own secret key (each store is paid into its owner's account, never ours).
/// Hosted Checkout: the shopper types their card on Stripe's page, so no card data ever reaches this server.
/// </summary>
internal sealed class StripeGateway(IHttpClientFactory http, ILogger<StripeGateway> log, IConfiguration configuration)
{
    public const string ClientName = "store-stripe";
    // Overridable only so automated tests can point at a stand-in; production uses Stripe's own address.
    private string Base => (configuration["Ecommerce:StripeApiBase"] ?? "https://api.stripe.com").TrimEnd('/') + "/v1";

    public async Task<(string SessionId, string Url)> CreateCheckoutAsync(
        string secretKey, Store store, StoreOrder order, string successUrl, string cancelUrl, CancellationToken ct)
    {
        var cur = order.CurrencyCode.ToLowerInvariant();
        var f = new List<KeyValuePair<string, string>>
        {
            new("mode", "payment"),
            new("success_url", successUrl),
            new("cancel_url", cancelUrl),
            new("customer_email", order.Email),
            new("client_reference_id", order.Number),
            new("metadata[order_id]", order.Id.ToString()),
            new("metadata[order_number]", order.Number),
            new("payment_intent_data[metadata][order_id]", order.Id.ToString()),
            // Stripe's minimum session life is 30 minutes. We hold the stock for a little longer.
            new("expires_at", DateTimeOffset.UtcNow.AddMinutes(60).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)),
        };

        var i = 0;
        // Everything is sent as listed prices; discount is a coupon so the lines still show what was bought.
        foreach (var l in order.Lines)
        {
            AddLine(f, i++, $"{l.Title}{(string.IsNullOrWhiteSpace(l.VariantName) ? "" : " – " + l.VariantName)}", cur,
                Money.ToMinor(l.UnitPrice, order.CurrencyCode), l.Quantity);
        }
        if (order.ShippingTotal > 0) AddLine(f, i++, order.ShippingMethod ?? "Shipping", cur, Money.ToMinor(order.ShippingTotal, order.CurrencyCode), 1);
        // Tax is a separate line only when it is added on top; when prices already include it, it is inside the lines.
        if (!store.PricesIncludeTax && order.TaxTotal > 0) AddLine(f, i++, "Tax", cur, Money.ToMinor(order.TaxTotal, order.CurrencyCode), 1);

        if (order.DiscountTotal > 0)
        {
            var coupon = await PostAsync(secretKey, "/coupons", [
                new("amount_off", Money.ToMinor(order.DiscountTotal, order.CurrencyCode).ToString(CultureInfo.InvariantCulture)),
                new("currency", cur), new("duration", "once"), new("name", order.DiscountCode ?? "Discount"),
            ], ct);
            f.Add(new("discounts[0][coupon]", coupon.GetProperty("id").GetString()!));
        }

        var session = await PostAsync(secretKey, "/checkout/sessions", f, ct);
        return (session.GetProperty("id").GetString()!, session.GetProperty("url").GetString()!);
    }

    private static void AddLine(List<KeyValuePair<string, string>> f, int index, string name, string currency, long unitAmount, int qty)
    {
        var p = $"line_items[{index}]";
        f.Add(new($"{p}[quantity]", qty.ToString(CultureInfo.InvariantCulture)));
        f.Add(new($"{p}[price_data][currency]", currency));
        f.Add(new($"{p}[price_data][unit_amount]", unitAmount.ToString(CultureInfo.InvariantCulture)));
        f.Add(new($"{p}[price_data][product_data][name]", name.Length > 250 ? name[..250] : name));
    }

    public async Task<StripeSessionInfo> GetSessionAsync(string secretKey, string sessionId, CancellationToken ct)
    {
        var s = await GetAsync(secretKey, "/checkout/sessions/" + Uri.EscapeDataString(sessionId), ct);
        return ReadSession(s);
    }

    public static StripeSessionInfo ReadSession(JsonElement s) => new(
        s.GetProperty("id").GetString()!,
        s.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "",
        s.TryGetProperty("payment_status", out var ps) ? ps.GetString() ?? "" : "",
        s.TryGetProperty("amount_total", out var at) && at.ValueKind == JsonValueKind.Number ? at.GetInt64() : null,
        s.TryGetProperty("currency", out var cu) ? cu.GetString() : null,
        s.TryGetProperty("payment_intent", out var pi) && pi.ValueKind == JsonValueKind.String ? pi.GetString() : null);

    public async Task RefundAsync(string secretKey, string paymentIntentId, CancellationToken ct) =>
        await PostAsync(secretKey, "/refunds", [new("payment_intent", paymentIntentId)], ct);

    /// <summary>
    /// Checks a webhook really came from Stripe: HMAC-SHA256 of "timestamp.payload" under the endpoint's signing secret, and
    /// a timestamp near now (so a captured request cannot be replayed later).
    /// </summary>
    public static bool VerifySignature(string payload, string? header, string secret, DateTimeOffset now, int toleranceSeconds = 300)
    {
        if (string.IsNullOrWhiteSpace(header) || string.IsNullOrWhiteSpace(secret)) return false;
        string? ts = null; var sigs = new List<string>();
        foreach (var part in header.Split(','))
        {
            var kv = part.Split('=', 2);
            if (kv.Length != 2) continue;
            if (kv[0].Trim() == "t") ts = kv[1].Trim();
            else if (kv[0].Trim() == "v1") sigs.Add(kv[1].Trim());
        }
        if (ts is null || sigs.Count == 0 || !long.TryParse(ts, NumberStyles.None, CultureInfo.InvariantCulture, out var seconds)) return false;
        if (Math.Abs((now - DateTimeOffset.FromUnixTimeSeconds(seconds)).TotalSeconds) > toleranceSeconds) return false;

        var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{ts}.{payload}"))).ToLowerInvariant();
        var expectedBytes = Encoding.ASCII.GetBytes(expected);
        return sigs.Any(s => CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(s.ToLowerInvariant()), expectedBytes));
    }

    private async Task<JsonElement> GetAsync(string key, string path, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, Base + path);
        return await SendAsync(key, req, ct);
    }

    private async Task<JsonElement> PostAsync(string key, string path, IEnumerable<KeyValuePair<string, string>> form, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, Base + path) { Content = new FormUrlEncodedContent(form) };
        return await SendAsync(key, req, ct);
    }

    private async Task<JsonElement> SendAsync(string key, HttpRequestMessage req, CancellationToken ct)
    {
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        HttpResponseMessage res;
        try { res = await http.CreateClient(ClientName).SendAsync(req, ct); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(ex, "Stripe was unreachable.");
            throw new PaymentException("The card payment service could not be reached. Please try again.", transient: true);
        }
        using (res)
        {
            var body = await res.Content.ReadAsStringAsync(ct);
            if (res.IsSuccessStatusCode) return JsonDocument.Parse(body).RootElement.Clone();

            string? message = null;
            try { message = JsonDocument.Parse(body).RootElement.GetProperty("error").GetProperty("message").GetString(); } catch { /* not JSON */ }
            log.LogWarning("Stripe refused ({Status}): {Message}", (int)res.StatusCode, message);
            // The owner's key being wrong is their problem to fix; the shopper just needs to know it did not go through.
            throw new PaymentException(res.StatusCode is System.Net.HttpStatusCode.Unauthorized
                ? "Card payments are not set up correctly for this store."
                : "The card payment could not be started." + (message is null ? "" : " " + message), (int)res.StatusCode >= 500);
        }
    }
}

/// <summary>PayPal Orders v2 over REST with the owner's own client id + secret.</summary>
internal sealed class PayPalGateway(IHttpClientFactory http, ILogger<PayPalGateway> log, IConfiguration configuration)
{
    public const string ClientName = "store-paypal";

    // Overridable only so automated tests can point at a stand-in.
    private string Base(bool sandbox) =>
        (configuration["Ecommerce:PayPalApiBase"] ?? (sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com")).TrimEnd('/');

    public async Task<(string Id, string ApproveUrl)> CreateOrderAsync(
        string clientId, string secret, bool sandbox, StoreOrder order, string returnUrl, string cancelUrl, string brand, CancellationToken ct)
    {
        var token = await TokenAsync(clientId, secret, sandbox, ct);
        var body = new
        {
            intent = "CAPTURE",
            purchase_units = new[]
            {
                new
                {
                    reference_id = order.Number,
                    custom_id = order.Id.ToString(),
                    description = $"Order {order.Number}",
                    amount = new { currency_code = order.CurrencyCode.ToUpperInvariant(), value = Money.ToText(order.Total, order.CurrencyCode) },
                },
            },
            payment_source = new
            {
                paypal = new
                {
                    experience_context = new
                    {
                        brand_name = brand.Length > 120 ? brand[..120] : brand,
                        user_action = "PAY_NOW",
                        return_url = returnUrl,
                        cancel_url = cancelUrl,
                    },
                },
            },
        };
        var json = await SendAsync(sandbox, token, HttpMethod.Post, "/v2/checkout/orders", body, ct, requestId: "ord-" + order.Id.ToString("N"));
        var id = json.GetProperty("id").GetString()!;
        var url = json.GetProperty("links").EnumerateArray()
            .Where(l => l.GetProperty("rel").GetString() is "payer-action" or "approve")
            .Select(l => l.GetProperty("href").GetString()).FirstOrDefault()
            ?? throw new PaymentException("PayPal did not return a payment link.");
        return (id, url!);
    }

    public async Task<PayPalCaptureInfo> CaptureAsync(string clientId, string secret, bool sandbox, string paypalOrderId, CancellationToken ct)
    {
        var token = await TokenAsync(clientId, secret, sandbox, ct);
        var json = await SendAsync(sandbox, token, HttpMethod.Post, $"/v2/checkout/orders/{Uri.EscapeDataString(paypalOrderId)}/capture", new { }, ct, requestId: "cap-" + paypalOrderId);
        var status = json.GetProperty("status").GetString() ?? "";
        var capture = json.GetProperty("purchase_units")[0].GetProperty("payments").GetProperty("captures")[0];
        var amount = capture.GetProperty("amount");
        var currency = amount.GetProperty("currency_code").GetString() ?? "";
        var value = decimal.Parse(amount.GetProperty("value").GetString()!, CultureInfo.InvariantCulture);
        return new PayPalCaptureInfo(capture.TryGetProperty("status", out var cs) ? cs.GetString() ?? status : status,
            Money.ToMinor(value, currency), currency, capture.GetProperty("id").GetString());
    }

    public async Task RefundAsync(string clientId, string secret, bool sandbox, string captureId, CancellationToken ct)
    {
        var token = await TokenAsync(clientId, secret, sandbox, ct);
        // An empty body refunds the whole capture.
        await SendAsync(sandbox, token, HttpMethod.Post, $"/v2/payments/captures/{Uri.EscapeDataString(captureId)}/refund", new { }, ct, requestId: "ref-" + captureId);
    }

    private async Task<string> TokenAsync(string clientId, string secret, bool sandbox, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, Base(sandbox) + "/v1/oauth2/token")
        {
            Content = new FormUrlEncodedContent([new("grant_type", "client_credentials")]),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{secret}")));
        var json = await ExecuteAsync(req, ct, authFailureMessage: "PayPal payments are not set up correctly for this store.");
        return json.GetProperty("access_token").GetString()!;
    }

    private async Task<JsonElement> SendAsync(bool sandbox, string token, HttpMethod method, string path, object body, CancellationToken ct, string? requestId = null)
    {
        using var req = new HttpRequestMessage(method, Base(sandbox) + path)
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        // Makes a retried call safe: PayPal returns the first result instead of acting twice.
        if (requestId is not null) req.Headers.TryAddWithoutValidation("PayPal-Request-Id", requestId);
        return await ExecuteAsync(req, ct);
    }

    private async Task<JsonElement> ExecuteAsync(HttpRequestMessage req, CancellationToken ct, string? authFailureMessage = null)
    {
        HttpResponseMessage res;
        try { res = await http.CreateClient(ClientName).SendAsync(req, ct); }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(ex, "PayPal was unreachable.");
            throw new PaymentException("PayPal could not be reached. Please try again.", transient: true);
        }
        using (res)
        {
            var text = await res.Content.ReadAsStringAsync(ct);
            if (res.IsSuccessStatusCode) return JsonDocument.Parse(text).RootElement.Clone();
            log.LogWarning("PayPal refused ({Status}): {Body}", (int)res.StatusCode, text.Length > 500 ? text[..500] : text);
            throw new PaymentException(res.StatusCode is System.Net.HttpStatusCode.Unauthorized && authFailureMessage is not null
                ? authFailureMessage
                : "The PayPal payment could not be completed.", (int)res.StatusCode >= 500);
        }
    }
}
