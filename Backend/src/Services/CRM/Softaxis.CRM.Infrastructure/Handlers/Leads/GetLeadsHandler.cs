using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class GetLeadsHandler(CrmDbContext db) : IQueryHandler<GetLeadsQuery, IReadOnlyList<LeadDto>>
{
    public async Task<Result<IReadOnlyList<LeadDto>>> Handle(GetLeadsQuery query, CancellationToken ct)
    {
        var items = await db.Leads.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<LeadDto>>(items.Select(LeadMappings.ToDto).ToList());
    }
}
