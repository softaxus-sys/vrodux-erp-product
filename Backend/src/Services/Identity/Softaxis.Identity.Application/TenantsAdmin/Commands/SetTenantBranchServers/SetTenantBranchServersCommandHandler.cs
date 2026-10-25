using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantBranchServers;

public sealed class SetTenantBranchServersCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
    : ICommandHandler<SetTenantBranchServersCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(SetTenantBranchServersCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));
        if (cmd.Enabled && tenant.DeploymentType != DeploymentType.Cloud)
            return Result.Failure<TenantDto>(Error.Custom("Tenant.Conflict",
                "Branch servers sync with a cloud workspace. An on-premises (offline) install cannot use them."));

        tenant.SetBranchServersEnabled(cmd.Enabled);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);
        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
