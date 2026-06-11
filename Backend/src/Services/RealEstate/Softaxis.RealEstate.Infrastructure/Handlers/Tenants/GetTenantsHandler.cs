using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Tenants.Dtos;
using Softaxis.RealEstate.Application.Tenants.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Tenants;

internal sealed class GetTenantsHandler(RealEstateDbContext db)
    : IQueryHandler<GetTenantsQuery, IReadOnlyList<TenantDto>>
{
    public async Task<Result<IReadOnlyList<TenantDto>>> Handle(GetTenantsQuery query, CancellationToken ct)
    {
        var items = await db.Tenants.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name).ToListAsync(ct);

        return Result.Success<IReadOnlyList<TenantDto>>(items.Select(TenantMappings.ToDto).ToList());
    }
}
