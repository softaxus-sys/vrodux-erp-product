using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.DeleteTenant;

public sealed class DeleteTenantCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
    : ICommandHandler<DeleteTenantCommand>
{
    public async Task<Result> Handle(DeleteTenantCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure(Error.NotFoundById("Tenant", cmd.Id));

        tenantRepo.Remove(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
