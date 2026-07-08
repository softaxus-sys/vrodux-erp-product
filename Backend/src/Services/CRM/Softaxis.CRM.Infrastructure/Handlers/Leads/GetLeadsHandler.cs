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
        var items = await scoped.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<LeadDto>>(items.Select(LeadMappings.ToDto).ToList());
    }
}
