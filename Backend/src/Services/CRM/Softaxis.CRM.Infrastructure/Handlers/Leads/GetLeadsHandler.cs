using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class GetLeadsHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetLeadsQuery, IReadOnlyList<LeadDto>>
{
    public async Task<Result<IReadOnlyList<LeadDto>>> Handle(GetLeadsQuery query, CancellationToken ct)
    {
        // Role-based scope: full-view roles see all leads; assigned-only roles see just their own.
        var scoped = access.ScopeReadable(db.Leads.AsNoTracking().Where(x => !x.IsDeleted));

        // Projected, not materialised as entities. Selecting the whole row pulled Notes, Message and
        // CustomFields off disk for every lead — 892 physical LOB reads and 41 seconds on 6,019
        // leads, against 141 ms of CPU. That is past the 30-second command timeout, which is how
        // this list started failing outright. The list does not display those three fields, and the
        // drawer loads the full lead by id, so nothing is lost by never reading them here.
        var items = await scoped
            .OrderByDescending(x => x.CreatedAt)
            .Select(LeadListProjection.Select)
            .ToListAsync(ct);

        // One batched lookup for the whole page, so a converted lead can show what became of it
        // instead of being a dead end at "converted".
        var outcomes = await ConvertedDealOutcomes.LoadAsync(
            db, items.Select(i => i.ConvertedDealId), ct);

        return Result.Success<IReadOnlyList<LeadDto>>(items.Select(row =>
        {
            var (stage, value) = LeadListProjection.OutcomeFor(outcomes, row);
            return LeadListProjection.ToDto(row, stage, value);
        }).ToList());
    }
}
