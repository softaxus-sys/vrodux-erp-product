namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// A CRM activity / timeline entry — task, call, meeting, email, or note —
/// linked to a lead, deal, or customer. Tasks/calls/meetings can have a due
/// date and be marked complete; notes/emails are immediate log entries.
/// </summary>
public sealed class Activity
{
    private Activity() { }

    public Activity(string type, string subject, string? description,
        string relatedToType, Guid relatedToId, string? relatedToName,
        string? dueDate, string assignedTo)
    {
        Id            = Guid.NewGuid();
        Type          = type;            // task | call | meeting | email | note
        Subject       = subject.Trim();
        Description   = description?.Trim();
        RelatedToType = relatedToType;   // lead | deal | customer
        RelatedToId   = relatedToId;
        RelatedToName = relatedToName?.Trim();
        DueDate       = dueDate;
        AssignedTo    = assignedTo.Trim();
        Completed     = type is "note" or "email";   // log entries are inherently "done"
        if (Completed) CompletedAt = DateTime.UtcNow;
        CreatedAt     = DateTime.UtcNow;
    }

    public Guid      Id            { get; private set; }
    public string    Type          { get; private set; } = "task";
    public string    Subject       { get; private set; } = string.Empty;
    public string?   Description   { get; private set; }
    public string    RelatedToType { get; private set; } = string.Empty;
    public Guid      RelatedToId   { get; private set; }
    public string?   RelatedToName { get; private set; }
    public string?   DueDate       { get; private set; }
    public bool      Completed     { get; private set; }
    public DateTime? CompletedAt   { get; private set; }
    public string    AssignedTo    { get; private set; } = string.Empty;
    public bool      IsDeleted     { get; private set; }
    public DateTime  CreatedAt     { get; private set; }
    public DateTime? UpdatedAt     { get; private set; }

    public void Update(string type, string subject, string? description, string? dueDate, string assignedTo)
    {
        Type = type; Subject = subject.Trim(); Description = description?.Trim();
        DueDate = dueDate; AssignedTo = assignedTo.Trim(); UpdatedAt = DateTime.UtcNow;
    }

    public void Complete()   { Completed = true;  CompletedAt = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow; }
    public void Reopen()     { Completed = false; CompletedAt = null;            UpdatedAt = DateTime.UtcNow; }
    public void Delete()     { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }
}
