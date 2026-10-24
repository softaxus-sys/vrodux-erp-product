using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantMirror;

public sealed class SetTenantMirrorCommandHandler(
    ITenantRepository        tenantRepo,
    ISubscriptionAccessCache accessCache,
    IUnitOfWork              uow)
    : ICommandHandler<SetTenantMirrorCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(SetTenantMirrorCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));

        tenant.SetMirror(cmd.IsMirror);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        // The write-block decision is cached per tenant for 60s; drop it so the change applies at once.
        accessCache.Invalidate(tenant.Id);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
