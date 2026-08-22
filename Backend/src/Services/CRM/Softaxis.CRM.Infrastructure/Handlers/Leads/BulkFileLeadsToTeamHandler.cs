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

        var filed = 0;
        var skipped = ids.Count - leads.Count;   // ids that don't exist (or are deleted) count as skipped

        foreach (var l in leads)
        {
            if (!await access.CanEditAsync(l, ct)) { skipped++; continue; }

            // Filing is only meaningful for an owned record — an unassigned lead belongs to nobody,
            // so it belongs to no team either. AssignTo enforces that, and re-passing the current
            // owner keeps ownership untouched while changing only the team.
            l.AssignTo(l.AssignedToUserId, l.AssignedTo, cmd.TeamId);
            filed++;
        }

        if (filed > 0) await db.SaveChangesAsync(ct);

        return Result.Success(new BulkFileResultDto(filed, skipped));
    }
}
