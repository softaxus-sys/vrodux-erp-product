using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantIndustry;

public sealed class SetTenantIndustryCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
    : ICommandHandler<SetTenantIndustryCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(SetTenantIndustryCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));

        tenant.SetIndustry(string.IsNullOrWhiteSpace(cmd.Industry) ? null : cmd.Industry.Trim());
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
