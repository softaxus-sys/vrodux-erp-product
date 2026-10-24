using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenants;

public sealed class GetTenantsQueryHandler(ITenantRepository tenantRepo, IUserRepository userRepo)
    : IQueryHandler<GetTenantsQuery, IReadOnlyList<TenantDto>>
{
    public async Task<Result<IReadOnlyList<TenantDto>>> Handle(GetTenantsQuery query, CancellationToken ct)
    {
        var tenants  = await tenantRepo.GetAllAsync(ct);
        var awaiting = await userRepo.GetTenantIdsAwaitingActivationAsync(ct);
        return Result.Success<IReadOnlyList<TenantDto>>(tenants
            .Select(t => TenantMappings.ToDto(t) with { AwaitingActivation = awaiting.Contains(t.Id) })
            .ToList());
    }
}
