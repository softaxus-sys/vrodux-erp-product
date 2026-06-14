using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Application.Bidding.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class GetContractsHandler(ConstructionDbContext db)
    : IQueryHandler<GetContractsQuery, IReadOnlyList<ConstructionContractDto>>
{
    public async Task<Result<IReadOnlyList<ConstructionContractDto>>> Handle(GetContractsQuery query, CancellationToken ct)
    {
        var items = await db.Contracts.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ConstructionContractDto>>(items.Select(BiddingMappings.ToDto).ToList());
    }
}
