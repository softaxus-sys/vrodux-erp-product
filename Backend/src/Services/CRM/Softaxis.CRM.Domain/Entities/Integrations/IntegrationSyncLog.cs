namespace Softaxis.CRM.Domain.Entities.Integrations;

/// <summary>
/// One row per sync run (poll or webhook batch) — powers the per-integration
/// "Sync History" tab and health computation.
/// </summary>
public sealed class IntegrationSyncLog
{
    private IntegrationSyncLog() { }

    public IntegrationSyncLog(Guid integrationId, string trigger)
    {
        Id            = Guid.NewGuid();
        IntegrationId = integrationId;
        Trigger       = trigger;            // "webhook" | "poll" | "manual" | "oauth"
        Status        = "running";
        StartedAt     = DateTime.UtcNow;
    }

    public Guid     Id            { get; private set; }
    public Guid     IntegrationId { get; private set; }
    public string   Trigger       { get; private set; } = string.Empty;
    public string   Status        { get; private set; } = "running"; // running | success | failed
    public int      Fetched       { get; private set; }
    public int      Created       { get; private set; }
    public int      Duplicates    { get; private set; }
    public int      Failed        { get; private set; }
    public string?  Message       { get; private set; }
    public DateTime StartedAt     { get; private set; }
    public DateTime? CompletedAt  { get; private set; }

    public void Complete(int fetched, int created, int duplicates, int failed, string? message = null)
    {
        Fetched = fetched; Created = created; Duplicates = duplicates; Failed = failed;
        Message = message;
        Status  = failed > 0 && created == 0 && duplicates == 0 ? "failed" : "success";
        CompletedAt = DateTime.UtcNow;
    }

    public void Fail(string message)
    {
        Status = "failed"; Message = message.Length > 1000 ? message[..1000] : message;
        CompletedAt = DateTime.UtcNow;
    }
}
