using System.Text.Json;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.SetTenantConnectionStrings;

public sealed class SetTenantConnectionStringsCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
    : ICommandHandler<SetTenantConnectionStringsCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(SetTenantConnectionStringsCommand cmd, CancellationToken ct)
    {
        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));

        // Store as JSON — in production, encrypt this before persisting
        var json = JsonSerializer.Serialize(new
        {
            IdentityDb  = cmd.IdentityDb,
            PosDb       = cmd.PosDb,
            InventoryDb = cmd.InventoryDb,
        });

        tenant.SetConnectionStrings(json);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
