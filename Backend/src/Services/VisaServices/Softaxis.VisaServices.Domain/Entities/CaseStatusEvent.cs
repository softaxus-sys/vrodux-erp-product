namespace Softaxis.VisaServices.Domain.Entities;

/// <summary>
/// Append-only timeline entry on a visa case: status transitions, notes, RFI details,
/// document milestones. Never updated or deleted — powers the case Timeline tab.
/// </summary>
public sealed class CaseStatusEvent
{
    private CaseStatusEvent() { }

    public CaseStatusEvent(Guid visaCaseId, string eventType, string? fromStatus,
        string? toStatus, string? note, string byName)
    {
        Id         = Guid.NewGuid();
        VisaCaseId = visaCaseId;
        EventType  = eventType;   // status_change | note | document | assignment | created
        FromStatus = fromStatus;
        ToStatus   = toStatus;
        Note       = note?.Trim();
        ByName     = byName.Trim();
        CreatedAt  = DateTime.UtcNow;
    }

    public Guid     Id         { get; private set; }
    public Guid     VisaCaseId { get; private set; }
    public string   EventType  { get; private set; } = "note";
    public string?  FromStatus { get; private set; }
    public string?  ToStatus   { get; private set; }
    public string?  Note       { get; private set; }
    public string   ByName     { get; private set; } = string.Empty;
    public DateTime CreatedAt  { get; private set; }
}
