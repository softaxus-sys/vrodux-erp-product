using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Units.Dtos;
using Softaxis.RealEstate.Application.Units.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Units;

internal sealed class GetUnitsSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetUnitsSummaryQuery, UnitsSummaryDto>
{
    public async Task<Result<UnitsSummaryDto>> Handle(GetUnitsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.PropertyUnits.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.UnitType, x.RentPerYear }).ToListAsync(ct);

        return Result.Success(new UnitsSummaryDto(
            all.Count,
            all.Count(x => x.Status == "vacant"),
            all.Count(x => x.Status == "rented"),
            all.Count(x => x.Status == "sold"),
            all.Count(x => x.Status == "maintenance"),
            all.Where(x => x.Status == "rented").Sum(x => x.RentPerYear),
            all.Count > 0 ? Math.Round((double)all.Count(x => x.Status == "rented") / all.Count * 100, 1) : 0));
    }
}
