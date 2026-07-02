namespace Softaxis.AiAssistant.Domain.Entities;

/// <summary>
/// A durable landing spot for a business event (M4b). Producers raise events via <c>IAiEventBus</c>,
/// which stores one row here; a background processor drains them and runs any event automation rules
/// matching <see cref="EventKey"/>. Failures retry with backoff. Tenant-isolated like the rules.
/// </summary>
public sealed class AiEventInbox
{
    // EF ctor
    private AiEventInbox() { }

    public AiEventInbox(string eventKey, Guid? entityId, string? title, string? payloadJson)
    {
        Id          = Guid.NewGuid();
        EventKey    = eventKey.Trim().ToLowerInvariant();
        EntityId    = entityId;
        Title       = Truncate(title, 400);
        PayloadJson = Truncate(payloadJson, 4000);
        Status      = "pending";
        ReceivedAt  = DateTime.UtcNow;
    }

    public Guid    Id          { get; private set; }
    public string  EventKey    { get; private set; } = null!;
    public Guid?   EntityId    { get; private set; }
    public string? Title       { get; private set; }
    public string? PayloadJson { get; private set; }

    /// <summary>"pending" | "processing" | "processed" | "failed".</summary>
    public string  Status        { get; private set; } = "pending";
    public int      Attempts      { get; private set; }
    public DateTime? NextAttemptAt { get; private set; }
    public string?  Error         { get; private set; }
    /// <summary>How many rules this event fired (for observability).</summary>
    public int      RulesFired    { get; private set; }

    public DateTime  ReceivedAt  { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public DateTime  CreatedAt   { get; private set; }

    public void MarkProcessing()
    {
        Status = "processing";
        Attempts++;
    }

    public void MarkProcessed(int rulesFired)
    {
        Status      = "processed";
        RulesFired  = rulesFired;
        NextAttemptAt = null;
        Error       = null;
        ProcessedAt = DateTime.UtcNow;
    }

    /// <summary>Record a failure; retries with exponential backoff until <paramref name="maxAttempts"/>.</summary>
    public void MarkFailed(string error, int maxAttempts)
    {
        Error = Truncate(error, 1000);
        if (Attempts >= maxAttempts)
        {
            Status = "failed";
            NextAttemptAt = null;
        }
        else
        {
            Status = "pending";
            NextAttemptAt = DateTime.UtcNow.AddSeconds(Math.Pow(2, Attempts) * 15); // 30s, 60s, 120s, …
        }
    }

    private static string? Truncate(string? s, int max) =>
        string.IsNullOrEmpty(s) ? null : s.Length <= max ? s : s[..max];
}
