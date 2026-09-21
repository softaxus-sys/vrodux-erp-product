using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Notifications;

/// <summary>
/// Raises the alerts for handing a record to someone: the new owner is told it is theirs, and the
/// people above them in the hierarchy are told it landed on their team member.
///
/// <para><b>Why supervisors are notified at all.</b> A team lead is accountable for their team's
/// response time but has no reason to sit on the leads list refreshing it. Without this, the only
/// person who knows a lead arrived is the one person who might be on leave, driving, or already
/// holding twenty others.</para>
///
/// <para><b>Who counts as a supervisor.</b> This codebase's hierarchy is
/// admin → team lead → team member (<c>Team.TeamLeadUserId</c>) — there is no rung between team lead
/// and admin, and no parent-team link, so "manager" resolves to the same thing. Admins are
/// deliberately NOT notified per assignment: every tenant-wide-access holder would receive every
/// alert in the workspace, which is how a bell stops being read at all.</para>
///
/// <para><b>Supervisors are resolved from the OWNER's team memberships, not from the record's team
/// alone.</b> Filing can legitimately be null (a multi-team owner — see <c>ILeadAccessGuard</c>), and
/// a supervisor who hears nothing because of a filing gap is exactly the silence this exists to
/// remove.</para>
///
/// <para><b>⚠️ The link is attached only when the supervisor can actually open the record.</b> A team
/// lead sees a record only when it is filed to a team they lead (Module 31), so an unfiled record
/// would give them a notification whose link 404s. They still get told — awareness is the point —
/// but with no link rather than a broken one.</para>
/// </summary>
internal interface ICrmAssignmentNotifier
{
    /// <summary>
    /// Publishes the owner alert and the supervisor alerts for one assignment. Safe to call
    /// unconditionally: an unchanged owner, an empty owner, or a self-assignment all raise nothing.
    /// </summary>
    /// <param name="teamId">Team the record is filed to — decides whether a supervisor gets a link.</param>
    /// <param name="tenantId">
    /// Pass explicitly from any path with no ambient tenant (anonymous webhook, background sweep);
    /// null uses the ambient one.
    /// </param>
    Task NotifyAssignmentAsync(CrmAssignment assignment, Guid? tenantId = null, CancellationToken ct = default);

    /// <summary>
    /// Supervisor alerts on their own, for a record that arrived already owned rather than being
    /// handed over — an inbound portal lead, where the owner is told by the intake alert instead.
    /// </summary>
    Task NotifySupervisorsAsync(CrmSupervisorAlert alert, Guid? tenantId = null, CancellationToken ct = default);
}

/// <summary>One handover, described once so the owner and supervisor alerts cannot drift apart.</summary>
/// <param name="PreviousOwnerId">Owner before the change — an unchanged owner raises nothing.</param>
/// <param name="ActorUserId">Who made the change. Never alerted about their own action.</param>
internal sealed record CrmAssignment(
    Guid?  NewOwnerId,
    string? NewOwnerName,
    Guid?  PreviousOwnerId,
    Guid?  TeamId,
    Guid?  ActorUserId,
    string? ActorName,
    string EventKey,
    string SupervisorEventKey,
    string Noun,
    string RecordLabel,
    string Link,
    string RelatedToType,
    Guid   RelatedToId);

/// <summary>A supervisor-only alert (inbound lead), carrying the same fields the shared builder needs.</summary>
internal sealed record CrmSupervisorAlert(
    Guid   OwnerId,
    string? OwnerName,
    Guid?  TeamId,
    string EventKey,
    string Title,
    string Message,
    string Link,
    string RelatedToType,
    Guid   RelatedToId);

internal sealed class CrmAssignmentNotifier(CrmDbContext db, INotificationDispatcher notifications)
    : ICrmAssignmentNotifier
{
    /// <summary>A record's supervisors, and whether each can open it.</summary>
    private sealed record Supervisor(Guid UserId, string TeamName, bool CanOpenRecord);

    public async Task NotifyAssignmentAsync(CrmAssignment a, Guid? tenantId = null, CancellationToken ct = default)
    {
        if (a.NewOwnerId is not { } owner || owner == Guid.Empty) return;
        // Re-saving a record without touching its owner is the common case; alerting on it would turn
        // every edit into a notification.
        if (a.PreviousOwnerId == owner) return;

        var requests = new List<NotificationRequest>();

        // The actor assigning to themselves raises nothing — enforced in the dispatcher, but skipped
        // here too so a self-assignment does not run a supervisor query for no reason.
        if (a.ActorUserId != owner)
        {
            var by = string.IsNullOrWhiteSpace(a.ActorName) ? "" : $" by {a.ActorName}";
            requests.Add(new NotificationRequest(
                RecipientUserId: owner,
                Module:          NotificationModules.Crm,
                Event:           a.EventKey,
                Title:           $"{a.Noun} assigned to you",
                Message:         string.IsNullOrWhiteSpace(a.RecordLabel)
                                     ? $"A {a.Noun.ToLowerInvariant()} was assigned to you{by}."
                                     : $"{a.RecordLabel} was assigned to you{by}.",
                Link:            a.Link,
                Type:            "mention",
                RelatedToType:   a.RelatedToType,
                RelatedToId:     a.RelatedToId,
                TenantId:        tenantId,
                ActorUserId:     a.ActorUserId));
        }

        var ownerName = Display(a.NewOwnerName);
        foreach (var s in await SupervisorsAsync(owner, a.TeamId, tenantId, ct))
        {
            requests.Add(new NotificationRequest(
                RecipientUserId: s.UserId,
                Module:          NotificationModules.Crm,
                Event:           a.SupervisorEventKey,
                Title:           $"{a.Noun} assigned to {ownerName}",
                Message:         Supervised(a.RecordLabel, a.Noun, ownerName, s.TeamName, a.ActorName),
                // No link rather than one that 404s — see the class note.
                Link:            s.CanOpenRecord ? a.Link : null,
                // "info", not "mention": this is awareness of someone else's work, not a request to act.
                Type:            "info",
                RelatedToType:   a.RelatedToType,
                RelatedToId:     a.RelatedToId,
                TenantId:        tenantId,
                ActorUserId:     a.ActorUserId));
        }

        if (requests.Count > 0) await notifications.PublishManyAsync(requests, ct);
    }

    public async Task NotifySupervisorsAsync(CrmSupervisorAlert alert, Guid? tenantId = null, CancellationToken ct = default)
    {
        if (alert.OwnerId == Guid.Empty) return;

        var supervisors = await SupervisorsAsync(alert.OwnerId, alert.TeamId, tenantId, ct);
        if (supervisors.Count == 0) return;

        await notifications.PublishManyAsync(supervisors.Select(s => new NotificationRequest(
            RecipientUserId: s.UserId,
            Module:          NotificationModules.Crm,
            Event:           alert.EventKey,
            Title:           alert.Title,
            Message:         alert.Message,
            Link:            s.CanOpenRecord ? alert.Link : null,
            Type:            "info",
            RelatedToType:   alert.RelatedToType,
            RelatedToId:     alert.RelatedToId,
            TenantId:        tenantId)), ct);
    }

    private static string Display(string? name) =>
        string.IsNullOrWhiteSpace(name) ? "a team member" : name.Trim();

    private static string Supervised(string recordLabel, string noun, string ownerName, string teamName, string? actorName)
    {
        var what = string.IsNullOrWhiteSpace(recordLabel) ? $"A {noun.ToLowerInvariant()}" : recordLabel;
        var team = string.IsNullOrWhiteSpace(teamName) ? "" : $" ({teamName})";
        var by   = string.IsNullOrWhiteSpace(actorName) ? "" : $" by {actorName}";
        return $"{what} was assigned to your team member {ownerName}{team}{by}.";
    }

    /// <summary>
    /// Leads of every active team the owner belongs to, plus the lead of the team the record is filed
    /// to (which the owner need not be a member of). The owner is never their own supervisor.
    ///
    /// <para><b>Tenant scoping is applied by hand.</b> The Identity team views carry Identity's own
    /// TenantId and sit outside the CRM namespace filter, so without this a lookup would cross
    /// workspaces. An unresolved tenant returns nobody rather than everybody.</para>
    /// </summary>
    private async Task<IReadOnlyList<Supervisor>> SupervisorsAsync(
        Guid ownerId, Guid? recordTeamId, Guid? tenantId, CancellationToken ct)
    {
        if ((tenantId ?? TenantAmbient.TenantId) is not { } tid) return [];

        var rows = await db.Set<IdentityTeamView>()
            .Where(t => t.IsActive && !t.IsDeleted
                     && t.TenantId == tid
                     && t.TeamLeadUserId != null
                     && t.TeamLeadUserId != ownerId
                     && (t.Id == recordTeamId
                         || db.Set<IdentityTeamMemberView>().Any(m => m.TeamId == t.Id && m.UserId == ownerId)))
            .Select(t => new { t.Id, t.Name, t.TeamLeadUserId })
            .ToListAsync(ct);

        return rows
            // One person can lead several of the owner's teams. Keep the row that grants visibility,
            // so a supervisor who CAN open the record never gets the link-less version instead.
            .GroupBy(t => t.TeamLeadUserId!.Value)
            .Select(g =>
            {
                var best = g.FirstOrDefault(t => recordTeamId != null && t.Id == recordTeamId) ?? g.First();
                return new Supervisor(g.Key, best.Name, recordTeamId != null && best.Id == recordTeamId);
            })
            .ToList();
    }
}
