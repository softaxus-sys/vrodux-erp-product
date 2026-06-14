using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Brokers.Dtos;
using Softaxis.RealEstate.Application.Brokers.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Brokers;

internal sealed class GetBrokersSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetBrokersSummaryQuery, BrokersSummaryDto>
{
    public async Task<Result<BrokersSummaryDto>> Handle(GetBrokersSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Brokers.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Specialization, x.DealsCompleted, x.TotalCommission, x.Rating }).ToListAsync(ct);

        return Result.Success(new BrokersSummaryDto(
            all.Count,
            all.Count(x => x.Specialization == "residential"),
            all.Count(x => x.Specialization == "commercial"),
            all.Count(x => x.Specialization == "both"),
            all.Sum(x => x.DealsCompleted),
            all.Sum(x => x.TotalCommission),
            all.Count > 0 ? all.Average(x => (double)x.Rating) : 0));
    }
}
