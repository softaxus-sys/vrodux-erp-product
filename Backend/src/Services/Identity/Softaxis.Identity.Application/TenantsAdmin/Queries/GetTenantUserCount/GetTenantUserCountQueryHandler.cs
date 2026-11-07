using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Enums;
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
        // A free trial has no user limit (PlanSeatGuard skips it), so report it that way instead of the plan's cap.
        var unlimited = tenant.Status == TenantStatus.Trial || limits.MaxUsers < 0;

        return Result.Success(new TenantUserCountDto(
            TenantId:  query.Id,
            Count:     count,
            MaxUsers:  unlimited ? -1 : limits.MaxUsers,
            Remaining: unlimited ? -1 : Math.Max(0, limits.MaxUsers - count),
            AtLimit:   !unlimited && count >= limits.MaxUsers));
    }
}
