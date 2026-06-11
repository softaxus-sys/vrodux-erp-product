using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Application.Deals.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class GetDealsHandler(CrmDbContext db) : IQueryHandler<GetDealsQuery, IReadOnlyList<DealDto>>
{
    public async Task<Result<IReadOnlyList<DealDto>>> Handle(GetDealsQuery query, CancellationToken ct)
    {
        var items = await db.Deals.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.Value).ToListAsync(ct);

        return Result.Success<IReadOnlyList<DealDto>>(items.Select(DealMappings.ToDto).ToList());
    }
}
