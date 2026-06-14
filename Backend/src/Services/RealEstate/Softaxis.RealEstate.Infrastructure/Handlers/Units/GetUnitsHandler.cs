using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Units.Dtos;
using Softaxis.RealEstate.Application.Units.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Units;

internal sealed class GetUnitsHandler(RealEstateDbContext db)
    : IQueryHandler<GetUnitsQuery, IReadOnlyList<UnitDto>>
{
    public async Task<Result<IReadOnlyList<UnitDto>>> Handle(GetUnitsQuery query, CancellationToken ct)
    {
        var q = db.PropertyUnits.AsNoTracking().Where(x => !x.IsDeleted);
        if (query.PropertyId.HasValue) q = q.Where(x => x.PropertyId == query.PropertyId.Value);

        var items = await q.OrderBy(x => x.UnitNumber).ToListAsync(ct);
        return Result.Success<IReadOnlyList<UnitDto>>(items.Select(UnitMappings.ToDto).ToList());
    }
}
