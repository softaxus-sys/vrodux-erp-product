namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Platform billing configuration the super admin can change without a redeploy.
///
/// <para>
/// Deliberately holds NO secrets. Stripe's secret key, PayPal's client secret and both webhook
/// signing secrets stay in environment variables (<c>Billing__Stripe__SecretKey</c>, …) — putting
/// a live payment secret in the application database widens the blast radius of a DB read, a
/// SQL-injection bug, or a leaked backup to "can charge cards as us". What lives here is the
/// operational half that legitimately changes often and is not sensitive: which providers are on,
/// sandbox vs live, the billing currency, and the price/plan ids created in each dashboard.
/// </para>
///
/// <para>
/// Single row. A provider is only ever usable when it is enabled here AND its secret is present in
/// the environment, so switching a provider on before its credentials exist can never surface a
/// broken checkout to a customer — it just reports "not configured".
/// </para>
/// </summary>
public sealed class BillingSettings
{
    /// <summary>
    /// Fixed id for the single row. A well-known key makes the upsert a plain find-or-create with
    /// no "which row is current?" ambiguity and no way to end up with two competing configs.
    /// </summary>
    public static readonly Guid SingletonId = new("b1111111-0000-4000-8000-000000000001");

    private BillingSettings() { }

    public BillingSettings(string? updatedBy = null)
    {
        Id        = SingletonId;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public Guid Id { get; private set; }

    // ── Stripe ────────────────────────────────────────────────────────────────

    public bool StripeEnabled { get; private set; }

    /// <summary>Stripe Price ids keyed <c>"Micro:Monthly"</c>, <c>"Professional:Annual"</c>, …</summary>
    public Dictionary<string, string> StripePrices { get; private set; } = [];

    // ── PayPal ────────────────────────────────────────────────────────────────

    public bool PayPalEnabled { get; private set; }

    /// <summary>
    /// Sandbox by default — live is opt-in, so a misconfiguration charges nobody's real card.
    /// </summary>
    public bool PayPalUseSandbox { get; private set; } = true;

    /// <summary>PayPal Billing Plan ids, keyed the same way as <see cref="StripePrices"/>.</summary>
    public Dictionary<string, string> PayPalPlans { get; private set; } = [];

    // ── Shared ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Currency every plan is charged in, regardless of a tenant's display currency.
    /// Null falls back to the environment value.
    /// </summary>
    public string? Currency { get; private set; }

    public DateTime UpdatedAt { get; private set; }
    public string?  UpdatedBy { get; private set; }

    public void Update(
        bool                       stripeEnabled,
        IDictionary<string,string> stripePrices,
        bool                       payPalEnabled,
        bool                       payPalUseSandbox,
        IDictionary<string,string> payPalPlans,
        string?                    currency,
        string?                    updatedBy)
    {
        StripeEnabled    = stripeEnabled;
        StripePrices     = Clean(stripePrices);
        PayPalEnabled    = payPalEnabled;
        PayPalUseSandbox = payPalUseSandbox;
        PayPalPlans      = Clean(payPalPlans);
        Currency         = string.IsNullOrWhiteSpace(currency) ? null : currency.Trim().ToUpperInvariant();
        UpdatedAt        = DateTime.UtcNow;
        UpdatedBy        = updatedBy;
    }

    /// <summary>
    /// Blank ids are dropped rather than stored as empty strings: the options lookup treats a
    /// missing key and a blank value the same, and not storing them keeps "which tiers are
    /// actually purchasable" answerable by looking at the row.
    /// </summary>
    private static Dictionary<string, string> Clean(IDictionary<string, string> source) =>
        source.Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
              .ToDictionary(kv => kv.Key, kv => kv.Value.Trim());
}
