using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Services;

/// <summary>
/// Writes the <see cref="LeadStatusHistory"/> trail behind every lead. Centralised for the same reason
/// as <see cref="IDealStageRecorder"/>: a lead's status can change from four places (create, the status
/// control, the edit form, conversion), and a gap in any one of them would leave the journey silently
/// incomplete rather than failing loudly.
/// </summary>
public interface ILeadStatusRecorder
{
    /// <summary>Records the lead's opening status. Call once, right after the lead is created.</summary>
    void RecordCreated(Lead lead);

    /// <summary>
    /// Records a transition if <paramref name="previousStatus"/> actually differs from the lead's current
    /// status. A no-op otherwise, so callers can invoke it unconditionally after any save path.
    /// </summary>
    Task RecordChangeAsync(Lead lead, string previousStatus, CancellationToken ct);
}

internal sealed class LeadStatusRecorder(CrmDbContext db, ICurrentUser user) : ILeadStatusRecorder
{
    public void RecordCreated(Lead lead) =>
        db.LeadStatusHistory.Add(new LeadStatusHistory(
            lead.Id, fromStatus: null, toStatus: lead.Status,
            daysInFromStatus: 0, user.Id, user.Username));

    public async Task RecordChangeAsync(Lead lead, string previousStatus, CancellationToken ct)
    {
        if (string.Equals(previousStatus, lead.Status, StringComparison.OrdinalIgnoreCase)) return;

        // How long the lead sat in the status it is leaving: since its last transition, or since the lead
        // was created if this is its first. Leads created before history existed have no rows, so they
        // correctly fall back to their creation date.
        var lastChangeAt = await db.LeadStatusHistory.AsNoTracking()
            .Where(h => h.LeadId == lead.Id)
            .OrderByDescending(h => h.CreatedAt)
            .Select(h => (DateTime?)h.CreatedAt)
            .FirstOrDefaultAsync(ct);

        var days = (DateTime.UtcNow - (lastChangeAt ?? lead.CreatedAt)).TotalDays;

        db.LeadStatusHistory.Add(new LeadStatusHistory(
            lead.Id, previousStatus, lead.Status, (int)days, user.Id, user.Username));
    }
}
