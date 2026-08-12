using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// A tenant's billing agreement — one row per tenant (the current subscription).
/// <para>
/// Vrodux's own DB is the source of truth for <b>entitlement</b>; the provider (Stripe/PayPal) is the
/// source of truth for <b>money</b>. Webhooks reconcile the two, and every state change here is applied
/// in the same transaction as the matching <see cref="Tenant"/> status change, so access can never drift
/// out of step with payment.
/// </para>
/// </summary>
public sealed class Subscription : AuditableEntity<Guid>
{
    private Subscription() { }   // EF

    private Subscription(Guid id, Guid tenantId, PlanType plan, BillingPeriod period,
                         PaymentProvider provider, decimal amount, string currency) : base(id)
    {
        TenantId      = tenantId;
        Plan          = plan;
        BillingPeriod = period;
        Provider      = provider;
        Amount        = amount;
        Currency      = currency;
        Status        = SubscriptionStatus.Incomplete;
        CreatedAt     = DateTime.UtcNow;
    }

    // ── Identity ──────────────────────────────────────────────────────────────

    public Guid               TenantId      { get; private set; }
    public PlanType           Plan          { get; private set; }
    public BillingPeriod      BillingPeriod { get; private set; }
    public SubscriptionStatus Status        { get; private set; }
    public PaymentProvider    Provider      { get; private set; }

    // ── Provider linkage ──────────────────────────────────────────────────────

    /// <summary>Stripe <c>cus_…</c> / PayPal payer id. Reused so a tenant keeps one customer record.</summary>
    public string? ProviderCustomerId { get; private set; }

    /// <summary>Stripe <c>sub_…</c> / PayPal <c>I-…</c>. The handle we reconcile webhooks against.</summary>
    public string? ProviderSubscriptionId { get; private set; }

    // ── Period + money ────────────────────────────────────────────────────────

    public DateTime? CurrentPeriodStart { get; private set; }
    public DateTime? CurrentPeriodEnd   { get; private set; }
    public DateTime? TrialEndsAt        { get; private set; }
    public DateTime? CanceledAt         { get; private set; }

    /// <summary>Cancelled by the customer but still paid up — access lasts until <see cref="CurrentPeriodEnd"/>.</summary>
    public bool CancelAtPeriodEnd { get; private set; }

    /// <summary>Charge per billing cycle (annual = the full yearly amount, not the per-month rate).</summary>
    public decimal Amount   { get; private set; }
    public string  Currency { get; private set; } = "USD";

    /// <summary>True when the subscription currently entitles the tenant to use the product.</summary>
    public bool GrantsAccess =>
        Status is SubscriptionStatus.Active or SubscriptionStatus.Trialing or SubscriptionStatus.PastDue
        || (Status == SubscriptionStatus.Canceled && CurrentPeriodEnd > DateTime.UtcNow);

    // ── Factory ───────────────────────────────────────────────────────────────

    public static Subscription Start(
        Guid tenantId, PlanType plan, BillingPeriod period, PaymentProvider provider,
        decimal amount, string currency = "USD") =>
        new(Guid.NewGuid(), tenantId, plan, period, provider, amount, currency);

    // ── Behaviour ─────────────────────────────────────────────────────────────

    public void LinkProvider(string? customerId, string? subscriptionId)
    {
        if (!string.IsNullOrWhiteSpace(customerId))     ProviderCustomerId     = customerId;
        if (!string.IsNullOrWhiteSpace(subscriptionId)) ProviderSubscriptionId = subscriptionId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Payment confirmed — the tenant is a paying customer for this period.</summary>
    public void Activate(DateTime? periodStart, DateTime? periodEnd)
    {
        Status             = SubscriptionStatus.Active;
        CurrentPeriodStart = periodStart ?? DateTime.UtcNow;
        CurrentPeriodEnd   = periodEnd;
        CanceledAt         = null;
        CancelAtPeriodEnd  = false;
        UpdatedAt          = DateTime.UtcNow;
    }

    public void MarkTrialing(DateTime trialEndsAt)
    {
        Status      = SubscriptionStatus.Trialing;
        TrialEndsAt = trialEndsAt;
        UpdatedAt   = DateTime.UtcNow;
    }

    /// <summary>Renewal payment failed. Access is retained while the provider retries.</summary>
    public void MarkPastDue()
    {
        Status    = SubscriptionStatus.PastDue;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Cancelled. Access survives to <see cref="CurrentPeriodEnd"/> unless <paramref name="immediate"/>.</summary>
    public void Cancel(bool immediate)
    {
        CanceledAt        = DateTime.UtcNow;
        CancelAtPeriodEnd = !immediate;
        Status            = immediate ? SubscriptionStatus.Expired : SubscriptionStatus.Canceled;
        if (immediate) CurrentPeriodEnd = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Fully lapsed — the paid period ran out and nothing renewed it.</summary>
    public void Expire()
    {
        Status    = SubscriptionStatus.Expired;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>Switch tier/cadence (upgrade or downgrade). Price is recalculated by the caller.</summary>
    public void ChangePlan(PlanType plan, BillingPeriod period, decimal amount)
    {
        Plan          = plan;
        BillingPeriod = period;
        Amount        = amount;
        UpdatedAt     = DateTime.UtcNow;
    }
}
