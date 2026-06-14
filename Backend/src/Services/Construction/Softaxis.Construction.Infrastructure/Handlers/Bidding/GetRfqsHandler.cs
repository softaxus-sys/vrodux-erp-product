using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Application.Bidding.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class GetRfqsHandler(ConstructionDbContext db)
    : IQueryHandler<GetRfqsQuery, IReadOnlyList<RfqDto>>
{
    public async Task<Result<IReadOnlyList<RfqDto>>> Handle(GetRfqsQuery query, CancellationToken ct)
    {
        var items = await db.Rfqs.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<RfqDto>>(items.Select(BiddingMappings.ToDto).ToList());
    }
}
