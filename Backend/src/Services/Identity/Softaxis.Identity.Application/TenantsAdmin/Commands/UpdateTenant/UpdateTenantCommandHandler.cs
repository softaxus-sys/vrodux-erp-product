using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.UpdateTenant;

public sealed class UpdateTenantCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
    : ICommandHandler<UpdateTenantCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(UpdateTenantCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));

        tenant.UpdateProfile(cmd.Name, cmd.ContactEmail, cmd.ContactPhone, cmd.Country, cmd.PrimaryColor);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
