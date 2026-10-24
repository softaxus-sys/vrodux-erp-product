using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Branches.Commands.SetBranchServerMode;

public sealed class SetBranchServerModeCommandHandler(
    IBranchRepository branchRepo,
    ICurrentUser      currentUser,
    ITenantContext    tenantContext,
    IUnitOfWork       uow)
    : ICommandHandler<SetBranchServerModeCommand>
{
    public async Task<Result> Handle(SetBranchServerModeCommand cmd, CancellationToken ct)
    {
        // Branch reads stay open (every branch switcher needs them); changes need the settings permission.
        if (!currentUser.IsSuperAdmin && !currentUser.HasPermission("settings.branches.edit"))
            return Result.Failure(Error.Custom("Branch.Forbidden", "Missing permission: settings.branches.edit"));

        var mode = cmd.Mode?.Trim().ToLowerInvariant();
        if (mode is not ("cloud" or "local"))
            return Result.Failure(Error.Custom("Validation.Failed", "Mode must be 'cloud' or 'local'."));

        // Tenants only ever act on their own branches; NotFound so another tenant's row never leaks.
        Guid? tenantScope = currentUser.IsSuperAdmin ? null : tenantContext.TenantId;
        var branch = await branchRepo.GetByIdAsync(cmd.Id, ct);
        if (branch is null || branch.TenantId != tenantScope)
            return Result.Failure(Error.NotFoundById("Branch", cmd.Id));

        branch.SetServerMode(mode);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
