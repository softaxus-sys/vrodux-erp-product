using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Application.Properties.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal sealed class GetPropertiesSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetPropertiesSummaryQuery, PropertiesSummaryDto>
{
    public async Task<Result<PropertiesSummaryDto>> Handle(GetPropertiesSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Properties.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.TotalUnits, x.OccupiedUnits, x.MarketValue, x.PropertyType })
            .ToListAsync(ct);

        var totalUnits = all.Sum(x => x.TotalUnits);
        var occupiedUnits = all.Sum(x => x.OccupiedUnits);

        return Result.Success(new PropertiesSummaryDto(
            all.Count,
            all.Count(x => x.PropertyType == "residential"),
            all.Count(x => x.PropertyType == "commercial"),
            all.Count(x => x.PropertyType == "mixed"),
            totalUnits,
            occupiedUnits,
            totalUnits > 0 ? Math.Round((double)occupiedUnits / totalUnits * 100, 1) : 0,
            all.Sum(x => x.MarketValue)));
    }
}
