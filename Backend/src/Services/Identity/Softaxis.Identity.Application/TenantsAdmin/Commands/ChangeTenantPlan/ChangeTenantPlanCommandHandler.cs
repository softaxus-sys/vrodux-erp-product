using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.TenantsAdmin.Commands.ChangeTenantPlan;

public sealed class ChangeTenantPlanCommandHandler(ITenantRepository tenantRepo, IUnitOfWork uow)
    : ICommandHandler<ChangeTenantPlanCommand, TenantDto>
{
    public async Task<Result<TenantDto>> Handle(ChangeTenantPlanCommand cmd, CancellationToken ct)
    {
        if (!Enum.TryParse<PlanType>(cmd.Plan, ignoreCase: true, out var plan))
            return Result.Failure<TenantDto>(Error.Custom("Tenant.InvalidPlan", $"Unknown plan: {cmd.Plan}"));

        var tenant = await tenantRepo.GetByIdAsync(cmd.Id, ct);
        if (tenant is null)
            return Result.Failure<TenantDto>(Error.NotFoundById("Tenant", cmd.Id));

        tenant.ChangePlan(plan);
        tenantRepo.Update(tenant);
        await uow.SaveChangesAsync(ct);

        return Result.Success(TenantMappings.ToDto(tenant));
    }
}
