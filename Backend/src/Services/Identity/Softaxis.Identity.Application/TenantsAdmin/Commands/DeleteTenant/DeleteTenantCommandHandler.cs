using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.DeleteTenant;

public sealed class DeleteTenantCommandHandler(
    ITenantRepository        tenantRepo,
    ISubscriptionAccessCache accessCache,
    IUnitOfWork              uow)
    : ICommandHandler<DeleteTenantCommand>
{
    public async Task<Result> Handle(DeleteTenantCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure(Error.NotFoundById("Tenant", cmd.Id));

        tenantRepo.Remove(tenant);
        await uow.SaveChangesAsync(ct);

        // SubscriptionEnforcementMiddleware caches its per-tenant decision for 60s, so without
        // this an already-signed-in user of the deleted tenant keeps working for up to a minute.
        // Dropping the entry makes the next request re-evaluate and block on TENANT_NOT_FOUND.
        accessCache.Invalidate(tenant.Id);

        return Result.Success();
    }
}
