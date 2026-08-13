namespace Softaxis.Identity.Application.Billing;

/// <summary>
/// What the super-admin billing settings screen shows. Split deliberately into what the admin can
/// change here (enabled flags, price/plan ids, sandbox) and what they can only see the *status* of
/// (whether a secret exists) — secrets live in environment variables and are never read back over
/// the API, not even masked.
/// </summary>
public sealed record BillingConfigDto(
    string Currency,
    // Origin the providers redirect back to. Deployment-level, env-only, read-only here.
    string PublicBaseUrl,
    BillingProviderConfigDto Stripe,
    BillingProviderConfigDto PayPal,
    DateTime? UpdatedAt,
    string?   UpdatedBy);

public sealed record BillingProviderConfigDto(
    bool Enabled,

    // True when the provider's secret is present in the environment. This is the half the admin
    // cannot fix from the UI, so the screen has to be able to say which piece is missing.
    bool HasSecret,

    // Present for PayPal only — Stripe's live/test split is decided by the key itself.
    bool? UseSandbox,

    // Price / plan ids keyed "Micro:Monthly", "Professional:Annual", …
    IReadOnlyDictionary<string, string> Ids,

    // Enabled AND secret present AND at least one id configured. Mirrors the same test the
    // checkout path applies, so the screen cannot report "ready" for something that would fail.
    bool IsUsable);

/// <summary>Payload for saving the config. Secrets are intentionally absent.</summary>
public sealed record UpdateBillingConfigRequest(
    string?                     Currency,
    bool                        StripeEnabled,
    Dictionary<string, string>? StripePrices,
    bool                        PayPalEnabled,
    bool                        PayPalUseSandbox,
    Dictionary<string, string>? PayPalPlans);
