using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Queries.GetTenantUserCount;

public sealed class GetTenantUserCountQueryHandler(
    ITenantRepository tenantRepo,
    IUserRepository   userRepo)
    : IQueryHandler<GetTenantUserCountQuery, TenantUserCountDto>
{
    public async Task<Result<TenantUserCountDto>> Handle(GetTenantUserCountQuery query, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(query.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantUserCountDto>(Error.NotFoundById("Tenant", query.Id));

        var count  = await userRepo.CountByTenantAsync(query.Id, ct);
        var limits = tenant.Limits;

        return Result.Success(new TenantUserCountDto(
            TenantId:  query.Id,
            Count:     count,
            MaxUsers:  limits.MaxUsers,
            Remaining: limits.MaxUsers < 0 ? -1 : Math.Max(0, limits.MaxUsers - count),
            AtLimit:   limits.MaxUsers >= 0 && count >= limits.MaxUsers));
    }
}
