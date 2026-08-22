using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

/// <summary>
/// Files a batch of opportunities to a team (null un-files). Mirrors the lead equivalent exactly,
/// including the per-record permission check — a bulk action must not become a way to touch records
/// the caller could not edit one at a time. Failures are skipped and counted, not thrown, so one
/// stray id in a selection does not lose the user's other work.
/// </summary>
internal sealed class BulkFileDealsToTeamHandler(CrmDbContext db, ILeadAccessGuard access)
    : ICommandHandler<BulkFileDealsToTeamCommand, BulkFileResultDto>
{
    public async Task<Result<BulkFileResultDto>> Handle(BulkFileDealsToTeamCommand cmd, CancellationToken ct)
    {
        if (cmd.DealIds.Count == 0) return Result.Success(new BulkFileResultDto(0, 0));

        var ids = cmd.DealIds.Distinct().ToList();
        var deals = await db.Deals.Where(d => ids.Contains(d.Id) && !d.IsDeleted).ToListAsync(ct);

        var filed = 0;
        var skipped = ids.Count - deals.Count;   // missing/deleted ids count as skipped

        foreach (var d in deals)
        {
            if (!await access.CanEditDealAsync(d, ct)) { skipped++; continue; }

            // Re-passing the current owner keeps ownership untouched and changes only the team.
            // AssignTo clears the team when there is no owner, so an unassigned deal cannot be filed.
            d.AssignTo(d.AssignedToUserId, d.AssignedTo, cmd.TeamId);
            filed++;
        }

        if (filed > 0) await db.SaveChangesAsync(ct);
        return Result.Success(new BulkFileResultDto(filed, skipped));
    }
}
