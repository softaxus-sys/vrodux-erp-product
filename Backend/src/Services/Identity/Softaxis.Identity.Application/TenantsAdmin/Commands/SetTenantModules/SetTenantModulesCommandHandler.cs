using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantModules;

/// <summary>
/// Super-admin-only editing of an existing tenant's modules. Always a manual grant — this endpoint
/// is reachable only through <c>TenantsAdminController</c>, so unlike self-serve onboarding's
/// <c>SetEnabledModules</c>, the plan is never the ceiling here (see <c>Tenant.ResolvedModules</c>).
/// </summary>
public sealed class SetTenantModulesCommandHandler(
    ITenantRepository      tenantRepo,
    ITenantRoleProvisioner roleProvisioner,
    IUnitOfWork            uow)
    : ICommandHandler<SetTenantModulesCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(SetTenantModulesCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));

        if (cmd.Modules is not null && cmd.Modules.Any(string.IsNullOrWhiteSpace))
            return Result.Failure<TenantDto>(Error.Custom(
                "Tenant.InvalidModules", "Module codes must be non-empty strings."));

        tenant.GrantModulesManually(cmd.Modules);
        tenantRepo.Update(tenant);

        // Top up "{Module} Manager" roles for anything newly granted — e.g. adding POS to an
        // already-live tenant should also create a POS Manager role here, not just at initial
        // creation. Never removes a role for a module taken away; see TenantRoleProvisioner.
        await roleProvisioner.EnsureModuleRolesAsync(tenant.Id, tenant.ResolvedModules, ct);

        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
