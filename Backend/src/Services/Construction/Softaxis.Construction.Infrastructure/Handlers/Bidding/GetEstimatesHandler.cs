using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Application.Bidding.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class GetEstimatesHandler(ConstructionDbContext db)
    : IQueryHandler<GetEstimatesQuery, IReadOnlyList<EstimateDto>>
{
    public async Task<Result<IReadOnlyList<EstimateDto>>> Handle(GetEstimatesQuery query, CancellationToken ct)
    {
        var items = await db.Estimates.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<EstimateDto>>(items.Select(BiddingMappings.ToDto).ToList());
    }
}
