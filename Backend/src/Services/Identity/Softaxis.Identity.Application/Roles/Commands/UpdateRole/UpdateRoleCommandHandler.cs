using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Roles.Commands.UpdateRole;

public sealed class UpdateRoleCommandHandler(
    IRoleRepository roleRepo,
    IUnitOfWork     uow)
    : ICommandHandler<UpdateRoleCommand, RoleDto>
{
    public async Task<Result<RoleDto>> Handle(UpdateRoleCommand cmd, CancellationToken ct)
    {
        var role = await roleRepo.GetByIdAsync(cmd.Id, ct);
        if (role is null) return Result.Failure<RoleDto>(Error.NotFoundById("Role", cmd.Id));

        if (role.IsSystem)
            return Result.Failure<RoleDto>(Error.Custom("Role.System.ReadOnly", "System roles cannot be modified."));

        if (await roleRepo.NameExistsAsync(cmd.Name, cmd.Id, ct))
            return Result.Failure<RoleDto>(Error.Custom("Role.Name.Taken", $"A role named '{cmd.Name}' already exists."));

        var result = role.Update(cmd.Name, cmd.Description);
        if (result.IsFailure) return Result.Failure<RoleDto>(result.Error);

        roleRepo.Update(role);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new RoleDto(
            role.Id, role.Name, role.Description, role.IsSystem,
            role.UserRoles.Count,
            role.RolePermissions.Select(rp => new PermissionDto(
                rp.Permission.Id, rp.Permission.ModuleId,
                rp.Permission.Action, rp.Permission.Description,
                rp.Permission.Key)).ToList()
        ));
    }
}
