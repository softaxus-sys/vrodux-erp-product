using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Durable log of every webhook received from a payment provider — the idempotency ledger.
/// <para>
/// Stripe and PayPal both retry aggressively (network blips, non-2xx, timeouts) and both may deliver
/// the same event more than once even on success. Without a uniqueness guard, re-processing an
/// <c>invoice.paid</c> would extend a paid period twice and hand out free service. The unique index on
/// (<see cref="Provider"/>, <see cref="ProviderEventId"/>) makes the insert itself the lock: if the row
/// already exists, the event has been seen and is acknowledged without re-applying it.
/// </para>
/// <para>
/// Rows are kept even after processing — when a payment dispute arises, this is the evidence trail.
/// </para>
/// </summary>
public sealed class BillingWebhookEvent : AuditableEntity<Guid>
{
    private BillingWebhookEvent() { }   // EF

    public BillingWebhookEvent(
        PaymentProvider provider,
        string          providerEventId,
        string          eventType,
        string?         payload) : base(Guid.NewGuid())
    {
        Provider        = provider;
        ProviderEventId = providerEventId;
        EventType       = eventType;
        Payload         = payload;
        ReceivedAt      = DateTime.UtcNow;
        CreatedAt       = DateTime.UtcNow;
    }

    public PaymentProvider Provider        { get; private set; }

    /// <summary>Provider's own event id (Stripe <c>evt_…</c>, PayPal event id). Unique per provider.</summary>
    public string          ProviderEventId { get; private set; } = string.Empty;

    public string          EventType       { get; private set; } = string.Empty;

    /// <summary>Raw JSON body, retained for replay and dispute forensics.</summary>
    public string?         Payload         { get; private set; }

    public DateTime        ReceivedAt      { get; private set; }
    public DateTime?       ProcessedAt     { get; private set; }

    /// <summary>Set when handling threw. The row stays so the failure is visible rather than silent.</summary>
    public string?         Error           { get; private set; }

    public void MarkProcessed()
    {
        ProcessedAt = DateTime.UtcNow;
        Error       = null;
        UpdatedAt   = DateTime.UtcNow;
    }

    public void MarkFailed(string error)
    {
        // Truncated — provider stack traces can be enormous and this column is diagnostic, not authoritative.
        Error     = error.Length > 2000 ? error[..2000] : error;
        UpdatedAt = DateTime.UtcNow;
    }
}
