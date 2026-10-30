using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Domain.Entities;
using Stripe;
using Stripe.Checkout;

namespace Softaxis.Identity.Infrastructure.Billing;

public sealed record PayPalCapture(string Status, decimal Amount, string Currency, string? CustomId, string? CaptureId);

/// <summary>
/// One-off payments for credits. Separate from <see cref="IBillingProvider"/> on purpose: that interface is
/// about subscriptions (products and plans created in each dashboard); a credit purchase is an ad-hoc amount
/// we price ourselves, so it needs NO product, price or plan to exist in Stripe or PayPal.
/// </summary>
internal sealed class CreditCheckoutGateway(
    IOptionsSnapshot<BillingOptions> options, IHttpClientFactory httpFactory, ILogger<CreditCheckoutGateway> logger)
{
    private BillingOptions Cfg => options.Value;

    public bool StripeReady => Cfg.Stripe.IsConfigured;
    public bool PayPalReady => Cfg.PayPal.IsConfigured;

    // ── Stripe: hosted Checkout with the price given inline ───────────────────

    public async Task<Result<(string Ref, string Url)>> CreateStripeAsync(
        Tenant tenant, CreditPurchase purchase, string productName, string description, string? customerId,
        string successUrl, string cancelUrl, CancellationToken ct)
    {
        if (!StripeReady) return Result.Failure<(string, string)>(Error.Custom("Billing.Stripe.NotConfigured", "Card payments are not available on this server."));
        try
        {
            var meta = new Dictionary<string, string>
            {
                ["type"] = "credits", ["purchase_id"] = purchase.Id.ToString(), ["tenant_id"] = tenant.Id.ToString(),
                ["module"] = purchase.ModuleKey, ["credits"] = purchase.Credits.ToString(),
            };
            var opts = new SessionCreateOptions
            {
                Mode = "payment",
                SuccessUrl = successUrl, CancelUrl = cancelUrl,
                ClientReferenceId = purchase.Id.ToString(),
                Metadata = meta,
                PaymentIntentData = new SessionPaymentIntentDataOptions { Metadata = meta, Description = $"{productName} — {tenant.Name}" },
                LineItems =
                [
                    new SessionLineItemOptions
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = purchase.Currency.ToLowerInvariant(),
                            UnitAmountDecimal = Math.Round(purchase.TotalAmount * 100m, 0),
                            ProductData = new SessionLineItemPriceDataProductDataOptions { Name = productName, Description = description },
                        },
                    },
                ],
            };
            // A tenant that already pays by card here gets its saved card offered; otherwise Stripe asks for the email.
            if (!string.IsNullOrWhiteSpace(customerId)) opts.Customer = customerId;
            else if (!string.IsNullOrWhiteSpace(tenant.ContactEmail)) opts.CustomerEmail = tenant.ContactEmail;

            var session = await new SessionService(new StripeClient(Cfg.Stripe.SecretKey)).CreateAsync(opts, cancellationToken: ct);
            return Result.Success((session.Id, session.Url));
        }
        catch (StripeException ex)
        {
            logger.LogError(ex, "Stripe credit checkout failed for purchase {Purchase}.", purchase.Id);
            return Result.Failure<(string, string)>(Error.Custom("Billing.Stripe.Error", ex.StripeError?.Message ?? ex.Message));
        }
    }

    // ── PayPal: an Order for the exact amount, captured by us on return ──────

    public async Task<Result<(string Ref, string Url)>> CreatePayPalAsync(
        Tenant tenant, CreditPurchase purchase, string description, string returnUrl, string cancelUrl, CancellationToken ct)
    {
        if (!PayPalReady) return Result.Failure<(string, string)>(Error.Custom("Billing.PayPal.NotConfigured", "PayPal is not available on this server."));
        try
        {
            var http = await AuthorizedAsync(ct);
            var body = new
            {
                intent = "CAPTURE",
                purchase_units = new[]
                {
                    new
                    {
                        reference_id = purchase.Id.ToString(),
                        custom_id = "credits:" + purchase.Id,     // echoed on the capture and on the webhook
                        description,
                        amount = new { currency_code = purchase.Currency, value = purchase.TotalAmount.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture) },
                    },
                },
                application_context = new { brand_name = "Vrodux ERP", user_action = "PAY_NOW", return_url = returnUrl, cancel_url = cancelUrl },
            };
            using var res = await http.PostAsync("/v2/checkout/orders", new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"), ct);
            var text = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode)
            {
                logger.LogError("PayPal create order failed: {Status} {Body}", res.StatusCode, text);
                return Result.Failure<(string, string)>(Error.Custom("Billing.PayPal.Error", "PayPal could not start the payment."));
            }
            using var doc = JsonDocument.Parse(text);
            var id = doc.RootElement.GetProperty("id").GetString()!;
            var approve = doc.RootElement.GetProperty("links").EnumerateArray()
                .Where(l => l.GetProperty("rel").GetString() is "approve" or "payer-action")
                .Select(l => l.GetProperty("href").GetString()).FirstOrDefault();
            return string.IsNullOrWhiteSpace(approve)
                ? Result.Failure<(string, string)>(Error.Custom("Billing.PayPal.NoApprovalUrl", "PayPal did not return an approval link."))
                : Result.Success((id, approve!));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "PayPal credit order failed for purchase {Purchase}.", purchase.Id);
            return Result.Failure<(string, string)>(Error.Custom("Billing.PayPal.Error", "Could not start the PayPal payment."));
        }
    }

    /// <summary>Takes the money for an approved order. Safe to call twice: PayPal answers a captured order with its existing capture.</summary>
    public async Task<Result<PayPalCapture>> CapturePayPalAsync(string orderId, CancellationToken ct)
    {
        if (!PayPalReady) return Result.Failure<PayPalCapture>(Error.Custom("Billing.PayPal.NotConfigured", "PayPal is not available on this server."));
        try
        {
            var http = await AuthorizedAsync(ct);
            using var req = new HttpRequestMessage(HttpMethod.Post, $"/v2/checkout/orders/{Uri.EscapeDataString(orderId)}/capture")
            { Content = new StringContent("{}", Encoding.UTF8, "application/json") };
            req.Headers.TryAddWithoutValidation("PayPal-Request-Id", "capture-" + orderId);   // idempotent on PayPal's side too
            using var res = await http.SendAsync(req, ct);
            var text = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode && !text.Contains("ORDER_ALREADY_CAPTURED"))
            {
                logger.LogError("PayPal capture failed: {Status} {Body}", res.StatusCode, text);
                return Result.Failure<PayPalCapture>(Error.Custom("Billing.PayPal.Error", "PayPal could not complete the payment."));
            }
            if (text.Contains("ORDER_ALREADY_CAPTURED")) return await ReadOrderAsync(http, orderId, ct);
            return ParseCapture(text);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "PayPal capture threw for order {Order}.", orderId);
            return Result.Failure<PayPalCapture>(Error.Custom("Billing.PayPal.Error", "Could not complete the PayPal payment."));
        }
    }

    private async Task<Result<PayPalCapture>> ReadOrderAsync(HttpClient http, string orderId, CancellationToken ct)
    {
        using var res = await http.GetAsync($"/v2/checkout/orders/{Uri.EscapeDataString(orderId)}", ct);
        return res.IsSuccessStatusCode ? ParseCapture(await res.Content.ReadAsStringAsync(ct))
            : Result.Failure<PayPalCapture>(Error.Custom("Billing.PayPal.Error", "PayPal could not confirm the payment."));
    }

    private static Result<PayPalCapture> ParseCapture(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var status = root.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
        var unit = root.GetProperty("purchase_units")[0];
        var customId = unit.TryGetProperty("custom_id", out var c) ? c.GetString() : null;
        if (!unit.TryGetProperty("payments", out var pay) || !pay.TryGetProperty("captures", out var caps) || caps.GetArrayLength() == 0)
            return Result.Failure<PayPalCapture>(Error.Custom("Billing.PayPal.NotCaptured", "The PayPal payment has not been completed."));
        var cap = caps[0];
        if (cap.TryGetProperty("status", out var cs) && !string.Equals(cs.GetString(), "COMPLETED", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<PayPalCapture>(Error.Custom("Billing.PayPal.NotCaptured", "The PayPal payment is not completed yet."));
        var amount = cap.GetProperty("amount");
        return Result.Success(new PayPalCapture(status,
            decimal.Parse(amount.GetProperty("value").GetString()!, System.Globalization.CultureInfo.InvariantCulture),
            amount.GetProperty("currency_code").GetString() ?? "USD", customId, cap.TryGetProperty("id", out var cid) ? cid.GetString() : null));
    }

    // ── PayPal token (own small cache; the subscription provider's is private) ─

    private static string? _token; private static string? _tokenFor; private static DateTime _expires = DateTime.MinValue; private static readonly SemaphoreSlim Lock = new(1, 1);

    private async Task<HttpClient> AuthorizedAsync(CancellationToken ct)
    {
        var http = httpFactory.CreateClient(PayPalBillingProvider.HttpClientName);
        http.BaseAddress = new Uri(Cfg.PayPal.BaseUrl);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await TokenAsync(ct));
        return http;
    }

    private async Task<string> TokenAsync(CancellationToken ct)
    {
        // Keyed by account + endpoint: switching sandbox/live or rotating the secret must not reuse the old token.
        var key = $"{Cfg.PayPal.BaseUrl}|{Cfg.PayPal.ClientId}";
        if (_token is not null && _tokenFor == key && DateTime.UtcNow < _expires) return _token;
        await Lock.WaitAsync(ct);
        try
        {
            if (_token is not null && _tokenFor == key && DateTime.UtcNow < _expires) return _token;
            var http = httpFactory.CreateClient(PayPalBillingProvider.HttpClientName);
            http.BaseAddress = new Uri(Cfg.PayPal.BaseUrl);
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(Encoding.UTF8.GetBytes($"{Cfg.PayPal.ClientId}:{Cfg.PayPal.ClientSecret}")));
            using var res = await http.PostAsync("/v1/oauth2/token", new FormUrlEncodedContent([new KeyValuePair<string, string>("grant_type", "client_credentials")]), ct);
            res.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            _token = doc.RootElement.GetProperty("access_token").GetString()!;
            _tokenFor = key;
            _expires = DateTime.UtcNow.AddSeconds(Math.Max(60, (doc.RootElement.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600) - 60));
            return _token;
        }
        finally { Lock.Release(); }
    }
}
