using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.ImpersonateTenant;

public sealed class ImpersonateTenantCommandHandler(
    ITenantRepository     tenantRepo,
    IUserRepository       userRepo,
    IPermissionRepository permissionRepo,
    IJwtTokenService      jwtService)
    : ICommandHandler<ImpersonateTenantCommand, ImpersonationResultDto>
{
    public async Task<Result<ImpersonationResultDto>> Handle(ImpersonateTenantCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.TenantId, ct);
        if (tenant is null)
            return Result.Failure<ImpersonationResultDto>(Error.NotFoundById("Tenant", cmd.TenantId));

        var superAdmin = await userRepo.GetByIdAsync(cmd.SuperAdminUserId, ct);
        if (superAdmin is null)
            return Result.Failure<ImpersonationResultDto>(Error.NotFoundById("User", cmd.SuperAdminUserId));

        // Full access to the tenant (Administrator-level) — the DB tenant filter still scopes every
        // read/write to this tenant, so this only grants operations, never cross-tenant visibility.
        var allPermissions = await permissionRepo.GetAllAsync(ct);
        var permissionKeys = allPermissions.Select(p => p.Key).ToList();

        var token = jwtService.GenerateAccessToken(
            superAdmin, permissionKeys, tenant, impersonatedBy: superAdmin.Id);

        return Result.Success(new ImpersonationResultDto(
            AccessToken: token,
            TenantId:    tenant.Id,
            TenantName:  tenant.Name,
            TenantSlug:  tenant.Slug));
    }
}
