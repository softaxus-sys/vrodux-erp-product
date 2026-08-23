using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

/// <summary>
/// Files a batch of accounts to a team (null un-files). Mirrors the lead and deal equivalents,
/// including the per-record permission check and skip-rather-than-fail behaviour.
/// </summary>
internal sealed class BulkFileCustomersToTeamHandler(CrmDbContext db, ILeadAccessGuard access)
    : ICommandHandler<BulkFileCustomersToTeamCommand, BulkFileResultDto>
{
    public async Task<Result<BulkFileResultDto>> Handle(BulkFileCustomersToTeamCommand cmd, CancellationToken ct)
    {
        if (cmd.CustomerIds.Count == 0) return Result.Success(new BulkFileResultDto(0, 0));

        var ids = cmd.CustomerIds.Distinct().ToList();
        var customers = await db.Customers.Where(c => ids.Contains(c.Id) && !c.IsDeleted).ToListAsync(ct);

        var filed = 0;
        var skipped = ids.Count - customers.Count;

        foreach (var c in customers)
        {
            if (!await access.CanEditCustomerAsync(c, ct)) { skipped++; continue; }

            c.AssignAccountManager(c.AccountManagerUserId, c.AccountManager, cmd.TeamId);
            filed++;
        }

        if (filed > 0) await db.SaveChangesAsync(ct);
        return Result.Success(new BulkFileResultDto(filed, skipped));
    }
}
