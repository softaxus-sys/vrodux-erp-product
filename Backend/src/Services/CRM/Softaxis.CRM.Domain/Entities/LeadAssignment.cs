namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// One handoff in a lead's assignment history — records who passed the lead to whom, by which actor,
/// and an optional note. The chain of these rows is the lead's pipeline trail (e.g. contact executive →
/// visit manager → …), visible to managers/admins. Append-only; never edited or deleted.
/// Auto tenant-isolated (lives in Softaxis.CRM.Domain → shadow TenantId + global filter).
/// </summary>
public sealed class LeadAssignment
{
    private LeadAssignment() { }

    public LeadAssignment(Guid leadId, Guid? fromUserId, string? fromUserName,
        Guid? toUserId, string toUserName, Guid? assignedByUserId, string? assignedByName, string? note)
    {
        Id               = Guid.NewGuid();
        LeadId           = leadId;
        FromUserId       = fromUserId;   FromUserName   = Trim(fromUserName);
        ToUserId         = toUserId;     ToUserName     = (toUserName ?? string.Empty).Trim();
        AssignedByUserId = assignedByUserId; AssignedByName = Trim(assignedByName);
        Note             = Trim(note);
        CreatedAt        = DateTime.UtcNow;
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public Guid    Id               { get; private set; }
    public Guid    LeadId           { get; private set; }
    public Guid?   FromUserId       { get; private set; }
    public string? FromUserName     { get; private set; }
    public Guid?   ToUserId         { get; private set; }
    public string  ToUserName       { get; private set; } = string.Empty;
    public Guid?   AssignedByUserId { get; private set; }
    public string? AssignedByName   { get; private set; }
    public string? Note             { get; private set; }
    public DateTime CreatedAt       { get; private set; }
}
