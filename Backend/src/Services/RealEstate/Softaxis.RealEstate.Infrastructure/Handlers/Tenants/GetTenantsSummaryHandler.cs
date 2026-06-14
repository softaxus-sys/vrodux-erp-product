using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Tenants.Dtos;
using Softaxis.RealEstate.Application.Tenants.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Tenants;

internal sealed class GetTenantsSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetTenantsSummaryQuery, TenantsSummaryDto>
{
    public async Task<Result<TenantsSummaryDto>> Handle(GetTenantsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Tenants.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.TenantType, x.Status, x.ActiveContracts, x.TotalPaid }).ToListAsync(ct);

        return Result.Success(new TenantsSummaryDto(
            all.Count,
            all.Count(x => x.TenantType == "individual"),
            all.Count(x => x.TenantType == "company"),
            all.Count(x => x.Status == "active"),
            all.Count(x => x.Status == "inactive"),
            all.Sum(x => x.ActiveContracts),
            all.Sum(x => x.TotalPaid)));
    }
}
