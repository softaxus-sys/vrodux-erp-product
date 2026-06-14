using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantModules;

public sealed class SetTenantModulesCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
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

        tenant.SetEnabledModules(cmd.Modules);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
