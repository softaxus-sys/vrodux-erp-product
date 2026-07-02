using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Roles.Commands.DeleteRole;

public sealed class DeleteRoleCommandHandler(
    IRoleRepository roleRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    IUnitOfWork     uow)
    : ICommandHandler<DeleteRoleCommand>
{
    public async Task<Result> Handle(DeleteRoleCommand cmd, CancellationToken ct)
    {
        var role = await roleRepo.GetByIdAsync(cmd.Id, ct);
        if (role is null) return Result.Failure(Error.NotFoundById("Role", cmd.Id));

        // A tenant can only delete its own roles.
        Guid? tenantScope = currentUser.IsSuperAdmin ? null : tenantContext.TenantId;
        if (tenantScope.HasValue && role.TenantId != tenantScope)
            return Result.Failure(Error.NotFoundById("Role", cmd.Id));

        if (role.IsSystem) return Result.Failure(Error.Custom("Role.System.ReadOnly", "System roles cannot be deleted."));
        if (role.UserRoles.Count > 0) return Result.Failure(Error.Custom("Role.InUse", $"Cannot delete a role assigned to {role.UserRoles.Count} user(s)."));

        roleRepo.Remove(role);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
