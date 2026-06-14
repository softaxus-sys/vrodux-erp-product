using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenantById;

public sealed class GetTenantByIdQueryHandler(ITenantRepository tenantRepo)
    : IQueryHandler<GetTenantByIdQuery, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(GetTenantByIdQuery query, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(query.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", query.Id));

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
