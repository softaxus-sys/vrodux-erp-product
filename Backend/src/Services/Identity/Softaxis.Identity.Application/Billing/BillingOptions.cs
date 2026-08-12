using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Application.Billing;

/// <summary>
/// Billing configuration. Bound from the <c>Billing</c> config section.
/// <para>
/// Every secret here MUST come from an environment variable in any deployed environment
/// (<c>Billing__Stripe__SecretKey</c>, …) — appsettings.json carries placeholders only,
/// matching how the repo handles the JWT secret.
/// </para>
/// </summary>
public sealed class BillingOptions
{
    public const string SectionName = "Billing";

    /// <summary>
    /// Public origin the payment providers redirect back to (e.g. <c>https://erp.vrodux.com</c>).
    /// Must be the externally reachable URL, not the container's internal address.
    /// </summary>
    public string PublicBaseUrl { get; set; } = "http://localhost:5173";

    /// <summary>Currency every plan is billed in, regardless of the tenant's display currency.</summary>
    public string Currency { get; set; } = "USD";

    public StripeOptions Stripe { get; set; } = new();
    public PayPalOptions PayPal { get; set; } = new();
}

public sealed class StripeOptions
{
    public bool    Enabled       { get; set; }
    public string? SecretKey     { get; set; }
    public string? PublishableKey{ get; set; }

    /// <summary>
    /// Signing secret (<c>whsec_…</c>) for the webhook endpoint. Without it every webhook is
    /// rejected — an unverified webhook is an open door to forged "payment succeeded" calls.
    /// </summary>
    public string? WebhookSecret { get; set; }

    /// <summary>
    /// Stripe Price ids per tier and cadence, keyed <c>"Micro:Monthly"</c>, <c>"Micro:Annual"</c>, …
    /// Created once in the Stripe dashboard; never hardcoded, since test and live differ.
    /// </summary>
    public Dictionary<string, string> Prices { get; set; } = [];

    public string? PriceFor(PlanType plan, BillingPeriod period) =>
        Prices.TryGetValue($"{plan}:{period}", out var id) && !string.IsNullOrWhiteSpace(id) ? id : null;

    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(SecretKey);
}

public sealed class PayPalOptions
{
    public bool    Enabled      { get; set; }
    public string? ClientId     { get; set; }
    public string? ClientSecret { get; set; }

    /// <summary>Webhook id from the PayPal dashboard — required to verify signatures.</summary>
    public string? WebhookId    { get; set; }

    /// <summary>Use the sandbox host instead of live. Defaults to sandbox to avoid charging real cards by accident.</summary>
    public bool    UseSandbox   { get; set; } = true;

    /// <summary>Billing Plan ids per tier and cadence, keyed the same way as Stripe's.</summary>
    public Dictionary<string, string> Plans { get; set; } = [];

    public string BaseUrl => UseSandbox
        ? "https://api-m.sandbox.paypal.com"
        : "https://api-m.paypal.com";

    public string? PlanFor(PlanType plan, BillingPeriod period) =>
        Plans.TryGetValue($"{plan}:{period}", out var id) && !string.IsNullOrWhiteSpace(id) ? id : null;

    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}
