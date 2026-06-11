using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.RenewTenantSubscription;

public sealed class RenewTenantSubscriptionCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
    : ICommandHandler<RenewTenantSubscriptionCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(RenewTenantSubscriptionCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));

        var expiresAt = cmd.ExpiresAt.ToUniversalTime();
        if (expiresAt <= DateTime.UtcNow)
            return Result.Failure<TenantDto>(Error.Custom("Tenant.InvalidExpiry", "Expiry date must be in the future."));

        tenant.RenewSubscription(expiresAt);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
