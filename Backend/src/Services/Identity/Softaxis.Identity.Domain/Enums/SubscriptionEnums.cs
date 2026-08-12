namespace Softaxis.Identity.Domain.Enums;

/// <summary>Who is collecting the money. Persisted as a string.</summary>
public enum PaymentProvider
{
    /// <summary>Stripe Checkout + Billing Portal.</summary>
    Stripe = 1,

    /// <summary>PayPal Subscriptions (REST v1).</summary>
    PayPal = 2,

    /// <summary>
    /// Off-platform: bank transfer, Enterprise contract, or a super-admin comp.
    /// Same lifecycle as the automated providers, just advanced by hand.
    /// </summary>
    Manual = 3,
}

/// <summary>
/// Lifecycle of a subscription. Mirrors the states Stripe and PayPal both express,
/// so either provider's webhooks can be mapped onto it.
/// </summary>
public enum SubscriptionStatus
{
    /// <summary>Free trial running; no payment taken yet.</summary>
    Trialing = 1,

    /// <summary>Paid and current.</summary>
    Active = 2,

    /// <summary>A renewal payment failed. Access continues during the retry window.</summary>
    PastDue = 3,

    /// <summary>Cancelled but still inside the paid period (access until it runs out).</summary>
    Canceled = 4,

    /// <summary>Fully lapsed — no access until a new subscription is paid.</summary>
    Expired = 5,

    /// <summary>Checkout started but never completed. Never grants access.</summary>
    Incomplete = 6,
}

/// <summary>Payment state of a single invoice.</summary>
public enum InvoiceStatus
{
    Open = 1,
    Paid = 2,
    Failed = 3,
    Refunded = 4,
    Void = 5,
}
