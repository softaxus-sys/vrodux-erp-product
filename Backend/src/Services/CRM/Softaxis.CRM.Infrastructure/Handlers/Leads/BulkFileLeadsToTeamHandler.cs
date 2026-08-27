using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

/// <summary>
/// Files a batch of leads to a team (or un-files them when TeamId is null).
///
/// <para>Every lead is still checked individually with <c>CanEditAsync</c> — a bulk action must not
/// become a way to touch records the caller could not edit one at a time. Leads that fail the check
/// are skipped and counted rather than failing the whole batch, so one stray id in a selection does
/// not lose the user's other work.</para>
///
/// <para><b>Filing can also change the owner.</b> A lead whose holder is not in the destination
/// team goes to that team's lead, who then distributes it — which is the point of filing the
/// triage pile a manager is sitting on, and the only way an UNOWNED lead can be filed at all
/// (<c>AssignTo</c> clears the team when there is no owner, so it would otherwise be a no-op).
/// A lead already held by a member of that team keeps its owner: filing must never take work off
/// the agent doing it.</para>
/// </summary>
internal sealed class BulkFileLeadsToTeamHandler(CrmDbContext db, ILeadAccessGuard access)
    : ICommandHandler<BulkFileLeadsToTeamCommand, BulkFileResultDto>
{
    public async Task<Result<BulkFileResultDto>> Handle(BulkFileLeadsToTeamCommand cmd, CancellationToken ct)
    {
        if (cmd.LeadIds.Count == 0)
            return Result.Success(new BulkFileResultDto(0, 0));

        var ids = cmd.LeadIds.Distinct().ToList();
        var leads = await db.Leads.Where(l => ids.Contains(l.Id) && !l.IsDeleted).ToListAsync(ct);

        // Who leads the destination team, and who is already in it.
        Guid? teamLeadUserId = null;
        var teamLeadName = "";
        var members = new HashSet<Guid>();
        if (cmd.TeamId is { } teamId)
        {
            teamLeadUserId = await db.Set<IdentityTeamView>()
                .Where(t => t.Id == teamId && t.IsActive && !t.IsDeleted)
                .Select(t => t.TeamLeadUserId)
                .FirstOrDefaultAsync(ct);

            members = (await db.Set<IdentityTeamMemberView>()
                .Where(m => m.TeamId == teamId)
                .Select(m => m.UserId)
                .ToListAsync(ct)).ToHashSet();

            if (teamLeadUserId is { } lead)
            {
                teamLeadName = await db.Set<IdentityUserView>()
                    .Where(u => u.Id == lead && !u.IsDeleted)
                    .Select(u => (u.FirstName + " " + u.LastName))
                    .FirstOrDefaultAsync(ct) ?? "";
                teamLeadName = teamLeadName.Trim();
            }
        }

        var filed = 0;
        var reassigned = 0;
        var skipped = ids.Count - leads.Count;   // ids that don't exist (or are deleted) count as skipped

        foreach (var l in leads)
        {
            if (!await access.CanEditAsync(l, ct)) { skipped++; continue; }

            var ownerId   = l.AssignedToUserId;
            var ownerName = l.AssignedTo;

            // Hand over only when the current holder is not part of this team — an unowned lead, or
            // one still sitting in someone else's triage pile. A team member keeps what they hold.
            var ownerIsInTeam = ownerId is { } oid && members.Contains(oid);
            if (cmd.TeamId is not null && teamLeadUserId is { } newOwner && !ownerIsInTeam)
            {
                ownerId   = newOwner;
                ownerName = teamLeadName;
                reassigned++;
            }

            l.AssignTo(ownerId, ownerName, cmd.TeamId);
            filed++;
        }

        if (filed > 0) await db.SaveChangesAsync(ct);

        return Result.Success(new BulkFileResultDto(filed, skipped, reassigned));
    }
}
