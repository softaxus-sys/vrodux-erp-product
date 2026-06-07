using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Roles.Commands.UpdateRolePermissions;

public sealed class UpdateRolePermissionsCommandHandler(
    IRoleRepository       roleRepo,
    IPermissionRepository permissionRepo,
    IUnitOfWork           uow)
    : ICommandHandler<UpdateRolePermissionsCommand, RoleDto>
{
    public async Task<Result<RoleDto>> Handle(UpdateRolePermissionsCommand cmd, CancellationToken ct)
    {
        var role = await roleRepo.GetByIdAsync(cmd.RoleId, ct);
        if (role is null) return Result.Failure<RoleDto>(Error.NotFoundById("Role", cmd.RoleId));
        if (role.IsSystem) return Result.Failure<RoleDto>(Error.Custom("Role.System.ReadOnly", "System role permissions cannot be modified."));

        var perms = await permissionRepo.GetByIdsAsync(cmd.PermissionIds, ct);
        role.SetPermissions(perms.Select(p => p.Id));
        roleRepo.Update(role);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new RoleDto(
            role.Id, role.Name, role.Description, role.IsSystem,
            role.UserRoles.Count,
            perms.Select(p => new PermissionDto(p.Id, p.ModuleId, p.Action, p.Description, p.Key)).ToList()
        ));
    }
}
