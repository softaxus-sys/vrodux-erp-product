using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Application.Properties.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal sealed class GetPropertyByIdHandler(RealEstateDbContext db)
    : IQueryHandler<GetPropertyByIdQuery, PropertyDto>
{
    public async Task<Result<PropertyDto>> Handle(GetPropertyByIdQuery query, CancellationToken ct)
    {
        var p = await db.Properties.AsNoTracking().Include(x => x.Units)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (p is null)
            return Result.Failure<PropertyDto>(Error.NotFoundById("Property", query.Id));

        return Result.Success(PropertyMappings.ToDto(p));
    }
}
