using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Brokers.Dtos;
using Softaxis.RealEstate.Application.Brokers.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Brokers;

internal sealed class GetBrokersHandler(RealEstateDbContext db)
    : IQueryHandler<GetBrokersQuery, IReadOnlyList<BrokerDto>>
{
    public async Task<Result<IReadOnlyList<BrokerDto>>> Handle(GetBrokersQuery query, CancellationToken ct)
    {
        var items = await db.Brokers.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.DealsCompleted).ToListAsync(ct);

        return Result.Success<IReadOnlyList<BrokerDto>>(items.Select(BrokerMappings.ToDto).ToList());
    }
}
