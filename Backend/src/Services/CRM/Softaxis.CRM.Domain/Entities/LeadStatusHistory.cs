namespace Softaxis.CRM.Domain.Entities;

/// <summary>
/// One status transition on a lead — new → contacted → qualified → converted/unqualified.
///
/// <para>The lead itself only ever held its <i>current</i> status, so nothing could answer "when did
/// this go quiet?" or "how long did it sit at contacted?". Opportunities already had
/// <c>DealStageHistory</c> for exactly this; leads did not. Append-only; never edited or deleted.</para>
///
/// <para><c>DaysInFromStatus</c> is stored rather than derived, for the same reason as
/// <c>DealStageHistory.DaysInFromStage</c>: computing time-in-status at read time needs a per-lead
/// window function, which EF cannot translate. The duration is knowable at write time, so it is
/// measured once. Clamped at zero — clock skew must never produce a negative dwell.</para>
///
/// Auto tenant-isolated (lives in Softaxis.CRM.Domain → shadow TenantId + global filter).
/// </summary>
public sealed class LeadStatusHistory
{
    private LeadStatusHistory() { }

    public LeadStatusHistory(Guid leadId, string? fromStatus, string toStatus,
        int? daysInFromStatus, Guid? changedByUserId, string? changedByName)
    {
        Id               = Guid.NewGuid();
        LeadId           = leadId;
        FromStatus       = Trim(fromStatus);
        ToStatus         = (toStatus ?? string.Empty).Trim();
        DaysInFromStatus = daysInFromStatus is null ? null : Math.Max(0, daysInFromStatus.Value);
        ChangedByUserId  = changedByUserId;
        ChangedByName    = Trim(changedByName);
        CreatedAt        = DateTime.UtcNow;
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    public Guid     Id               { get; private set; }
    public Guid     LeadId           { get; private set; }
    public string?  FromStatus       { get; private set; }
    public string   ToStatus         { get; private set; } = string.Empty;
    public int?     DaysInFromStatus { get; private set; }
    public Guid?    ChangedByUserId  { get; private set; }
    public string?  ChangedByName    { get; private set; }
    public DateTime CreatedAt        { get; private set; }
}
