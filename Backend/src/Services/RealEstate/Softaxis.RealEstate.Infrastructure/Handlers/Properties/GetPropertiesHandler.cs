using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Application.Properties.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal sealed class GetPropertiesHandler(RealEstateDbContext db)
    : IQueryHandler<GetPropertiesQuery, IReadOnlyList<PropertyDto>>
{
    public async Task<Result<IReadOnlyList<PropertyDto>>> Handle(GetPropertiesQuery query, CancellationToken ct)
    {
        var items = await db.Properties.AsNoTracking().Include(x => x.Units)
            .Where(x => !x.IsDeleted).OrderBy(x => x.Name).ToListAsync(ct);

        return Result.Success<IReadOnlyList<PropertyDto>>(items.Select(PropertyMappings.ToDto).ToList());
    }
}
