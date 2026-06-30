namespace Softaxis.CRM.Domain.Entities.Integrations;

/// <summary>
/// Durable inbox for raw inbound lead payloads. Webhooks store the payload here and
/// return 200 immediately; a background processor picks it up, runs it through the
/// intake pipeline, and records the outcome. Doubles as the per-integration "Error Log"
/// and the retry queue (failed rows are retried with backoff).
/// </summary>
public sealed class RawLeadInbox
{
    private RawLeadInbox() { }

    public RawLeadInbox(Guid integrationId, string providerKey, string payload, string? externalId)
    {
        Id            = Guid.NewGuid();
        IntegrationId = integrationId;
        ProviderKey   = providerKey;
        Payload       = payload;
        ExternalId    = externalId;
        Status        = RawLeadStatus.Pending;
        ReceivedAt    = DateTime.UtcNow;
    }

    public Guid     Id            { get; private set; }
    public Guid     IntegrationId { get; private set; }
    public string   ProviderKey   { get; private set; } = string.Empty;
    /// <summary>Provider's own lead id, when present — used for idempotent de-dup.</summary>
    public string?  ExternalId    { get; private set; }
    public string   Payload       { get; private set; } = string.Empty;
    public string   Status        { get; private set; } = RawLeadStatus.Pending;
    public int      Attempts      { get; private set; }
    public string?  LastError     { get; private set; }
    public Guid?    CreatedLeadId { get; private set; }
    public DateTime ReceivedAt    { get; private set; }
    public DateTime? ProcessedAt  { get; private set; }
    public DateTime? NextAttemptAt { get; private set; }

    public void MarkProcessing() { Attempts++; Status = RawLeadStatus.Processing; }

    public void MarkProcessed(Guid? leadId)
    {
        Status = RawLeadStatus.Processed; CreatedLeadId = leadId;
        LastError = null; ProcessedAt = DateTime.UtcNow; NextAttemptAt = null;
    }

    public void MarkDuplicate(Guid? existingLeadId)
    {
        Status = RawLeadStatus.Duplicate; CreatedLeadId = existingLeadId;
        ProcessedAt = DateTime.UtcNow; NextAttemptAt = null;
    }

    public void MarkFailed(string error, int maxAttempts)
    {
        LastError = error.Length > 1000 ? error[..1000] : error;
        if (Attempts >= maxAttempts)
        {
            Status = RawLeadStatus.Failed; NextAttemptAt = null;
        }
        else
        {
            Status = RawLeadStatus.Pending;
            // Exponential backoff: 1, 2, 4… minutes.
            NextAttemptAt = DateTime.UtcNow.AddMinutes(Math.Pow(2, Attempts - 1));
        }
    }
}

public static class RawLeadStatus
{
    public const string Pending    = "pending";
    public const string Processing = "processing";
    public const string Processed  = "processed";
    public const string Duplicate  = "duplicate";
    public const string Failed     = "failed";
}
