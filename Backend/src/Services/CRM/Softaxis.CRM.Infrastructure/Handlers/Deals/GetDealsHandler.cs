using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Application.Deals.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class GetDealsHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetDealsQuery, IReadOnlyList<DealDto>>
{
    public async Task<Result<IReadOnlyList<DealDto>>> Handle(GetDealsQuery query, CancellationToken ct)
    {
        // Scoped to the caller's pipeline tier: all / their team's / their own.
        var items = await access.ScopeDeals(db.Deals.AsNoTracking()).Where(x => !x.IsDeleted)
            .Where(x => query.CustomerId == null || x.CustomerId == query.CustomerId)
            .OrderByDescending(x => x.Value).ToListAsync(ct);

        return Result.Success<IReadOnlyList<DealDto>>(items.Select(DealMappings.ToDto).ToList());
    }
}
