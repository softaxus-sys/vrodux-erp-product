using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;

// Aliased for symmetry with StripeBillingProvider, where Stripe.Subscription forces the distinction.
using DomainSubscription = Softaxis.Identity.Domain.Entities.Subscription;

namespace Softaxis.Identity.Infrastructure.Billing;

/// <summary>
/// PayPal Subscriptions (REST v1) over a plain <see cref="HttpClient"/>.
/// <para>
/// PayPal has no maintained first-party .NET SDK, so this follows the same hand-rolled-client
/// pattern the codebase already uses for Meta Graph and the exchange-rate provider: OAuth2
/// client-credentials for a bearer token, then straight JSON calls.
/// </para>
/// </summary>
internal sealed class PayPalBillingProvider(
    IHttpClientFactory httpClientFactory,
    IOptions<BillingOptions> options,
    ILogger<PayPalBillingProvider> logger) : IBillingProvider
{
    public const string HttpClientName = "paypal-billing";

    private readonly BillingOptions _billing = options.Value;
    private PayPalOptions Cfg => _billing.PayPal;

    public PaymentProvider Provider => PaymentProvider.PayPal;
    public bool IsConfigured => Cfg.IsConfigured;

    // Access tokens last ~9h; cached in-process and refreshed a minute early to avoid
    // racing the expiry on a long-running request.
    private string? _token;
    private DateTime _tokenExpiresAt = DateTime.MinValue;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);

    // ── Public API ───────────────────────────────────────────────────────────

    public async Task<Result<string>> CreateCheckoutUrlAsync(
        Tenant tenant, PlanType plan, BillingPeriod period, string successUrl, string cancelUrl, CancellationToken ct)
    {
        if (!IsConfigured)
            return Result.Failure<string>(Error.Custom("Billing.PayPal.NotConfigured", "PayPal is not configured on this server."));

        var planId = Cfg.PlanFor(plan, period);
        if (planId is null)
            return Result.Failure<string>(Error.Custom(
                "Billing.PayPal.PlanMissing",
                $"No PayPal plan is configured for {plan} / {period}. Add Billing:PayPal:Plans:{plan}:{period}."));

        try
        {
            var http = await AuthorizedClientAsync(ct);

            var body = new
            {
                plan_id = planId,
                // custom_id is echoed on every subsequent webhook — our reconciliation key,
                // exactly like Stripe's metadata. Never trust the browser's return URL for this.
                custom_id = tenant.Id.ToString(),
                subscriber = new
                {
                    email_address = string.IsNullOrWhiteSpace(tenant.ContactEmail) ? null : tenant.ContactEmail,
                },
                application_context = new
                {
                    brand_name  = "Vrodux ERP",
                    user_action = "SUBSCRIBE_NOW",
                    return_url  = successUrl,
                    cancel_url  = cancelUrl,
                },
            };

            using var res = await http.PostAsJsonAsync("/v1/billing/subscriptions", body, ct);
            if (!res.IsSuccessStatusCode)
                return Result.Failure<string>(await ErrorFromAsync(res, "create subscription", ct));

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));

            var approveUrl = doc.RootElement.TryGetProperty("links", out var links)
                ? links.EnumerateArray()
                       .FirstOrDefault(l => l.TryGetProperty("rel", out var rel) &&
                                            rel.GetString() == "approve")
                       .TryGetProperty("href", out var href) ? href.GetString() : null
                : null;

            if (string.IsNullOrWhiteSpace(approveUrl))
                return Result.Failure<string>(Error.Custom("Billing.PayPal.NoApprovalUrl",
                    "PayPal did not return an approval link."));

            return Result.Success(approveUrl);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "PayPal checkout failed for tenant {TenantId}.", tenant.Id);
            return Result.Failure<string>(Error.Custom("Billing.PayPal.Error", "Could not start PayPal checkout."));
        }
    }

    /// <summary>
    /// PayPal has no embeddable customer portal; subscribers manage payment methods inside their own
    /// PayPal account. Reported as a failure so the UI keeps using in-app controls instead.
    /// </summary>
    public Task<Result<string>> CreateManagementUrlAsync(DomainSubscription subscription, string returnUrl, CancellationToken ct) =>
        Task.FromResult(Result.Failure<string>(Error.Custom(
            "Billing.PayPal.NoPortal",
            "PayPal subscriptions are managed from your PayPal account. Use the controls here to change or cancel your plan.")));

    public async Task<Result> CancelAsync(DomainSubscription subscription, bool immediate, CancellationToken ct)
    {
        if (!IsConfigured)
            return Result.Failure(Error.Custom("Billing.PayPal.NotConfigured", "PayPal is not configured on this server."));

        if (string.IsNullOrWhiteSpace(subscription.ProviderSubscriptionId))
            return Result.Failure(Error.Custom("Billing.PayPal.NoSubscription", "No PayPal subscription to cancel."));

        try
        {
            var http = await AuthorizedClientAsync(ct);

            // PayPal cancels at once; "cancel at period end" is emulated locally by keeping
            // CurrentPeriodEnd on our Subscription, which still grants access until it passes.
            using var res = await http.PostAsJsonAsync(
                $"/v1/billing/subscriptions/{subscription.ProviderSubscriptionId}/cancel",
                new { reason = immediate ? "Cancelled by customer" : "Cancelled at period end by customer" }, ct);

            if (!res.IsSuccessStatusCode && res.StatusCode != System.Net.HttpStatusCode.NoContent)
                return Result.Failure(await ErrorFromAsync(res, "cancel subscription", ct));

            return Result.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "PayPal cancel failed for subscription {SubscriptionId}.", subscription.Id);
            return Result.Failure(Error.Custom("Billing.PayPal.Error", "Could not cancel the PayPal subscription."));
        }
    }

    // ── Webhook signature verification ───────────────────────────────────────

    /// <summary>
    /// Ask PayPal whether a webhook really came from them. Unlike Stripe there is no local HMAC —
    /// verification is an API call against the transmission headers.
    /// Returns false on any error, so an unverifiable event is never applied.
    /// </summary>
    public async Task<bool> VerifyWebhookAsync(
        IReadOnlyDictionary<string, string> headers, string rawBody, CancellationToken ct)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(Cfg.WebhookId))
        {
            logger.LogError("PayPal webhook received but Billing:PayPal:WebhookId is not configured — rejecting.");
            return false;
        }

        string? H(string key) => headers.TryGetValue(key, out var v) ? v : null;

        var transmissionId  = H("paypal-transmission-id");
        var transmissionSig = H("paypal-transmission-sig");
        var transmissionTs  = H("paypal-transmission-time");
        var certUrl         = H("paypal-cert-url");
        var authAlgo        = H("paypal-auth-algo");

        if (transmissionId is null || transmissionSig is null || transmissionTs is null ||
            certUrl is null || authAlgo is null)
        {
            logger.LogWarning("PayPal webhook missing transmission headers — rejecting.");
            return false;
        }

        try
        {
            var http = await AuthorizedClientAsync(ct);

            // webhook_event must be the ORIGINAL JSON object, so it is spliced in raw rather than
            // re-serialised — any reformatting changes the payload PayPal signed.
            var payload = $$"""
                {
                  "transmission_id": {{JsonSerializer.Serialize(transmissionId)}},
                  "transmission_time": {{JsonSerializer.Serialize(transmissionTs)}},
                  "cert_url": {{JsonSerializer.Serialize(certUrl)}},
                  "auth_algo": {{JsonSerializer.Serialize(authAlgo)}},
                  "transmission_sig": {{JsonSerializer.Serialize(transmissionSig)}},
                  "webhook_id": {{JsonSerializer.Serialize(Cfg.WebhookId)}},
                  "webhook_event": {{rawBody}}
                }
                """;

            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var res = await http.PostAsync("/v1/notifications/verify-webhook-signature", content, ct);

            if (!res.IsSuccessStatusCode)
            {
                logger.LogWarning("PayPal signature verification call failed with {Status}.", res.StatusCode);
                return false;
            }

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var verified = doc.RootElement.TryGetProperty("verification_status", out var status) &&
                           status.GetString() == "SUCCESS";

            if (!verified) logger.LogWarning("PayPal webhook failed signature verification — rejecting.");
            return verified;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "PayPal webhook verification threw — rejecting.");
            return false;
        }
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private async Task<HttpClient> AuthorizedClientAsync(CancellationToken ct)
    {
        var http = httpClientFactory.CreateClient(HttpClientName);
        http.BaseAddress = new Uri(Cfg.BaseUrl);
        http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", await GetAccessTokenAsync(ct));
        return http;
    }

    private async Task<string> GetAccessTokenAsync(CancellationToken ct)
    {
        if (_token is not null && DateTime.UtcNow < _tokenExpiresAt) return _token;

        await _tokenLock.WaitAsync(ct);
        try
        {
            if (_token is not null && DateTime.UtcNow < _tokenExpiresAt) return _token;

            var http = httpClientFactory.CreateClient(HttpClientName);
            http.BaseAddress = new Uri(Cfg.BaseUrl);

            var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{Cfg.ClientId}:{Cfg.ClientSecret}"));
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", basic);

            using var form = new FormUrlEncodedContent([new KeyValuePair<string, string>("grant_type", "client_credentials")]);
            using var res  = await http.PostAsync("/v1/oauth2/token", form, ct);
            res.EnsureSuccessStatusCode();

            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            var token     = doc.RootElement.GetProperty("access_token").GetString()!;
            var expiresIn = doc.RootElement.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600;

            _token          = token;
            _tokenExpiresAt = DateTime.UtcNow.AddSeconds(Math.Max(60, expiresIn - 60));
            return token;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    private async Task<Error> ErrorFromAsync(HttpResponseMessage res, string what, CancellationToken ct)
    {
        var body = await res.Content.ReadAsStringAsync(ct);
        logger.LogError("PayPal failed to {What}: {Status} {Body}", what, res.StatusCode, body);
        return Error.Custom("Billing.PayPal.Error", $"PayPal could not {what}.");
    }
}
