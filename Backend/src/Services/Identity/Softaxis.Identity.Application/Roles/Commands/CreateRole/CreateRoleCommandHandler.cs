using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Roles.Commands.CreateRole;

public sealed class CreateRoleCommandHandler(
    IRoleRepository       roleRepo,
    IPermissionRepository permissionRepo,
    IUnitOfWork           uow)
    : ICommandHandler<CreateRoleCommand, RoleDto>
{
    public async Task<Result<RoleDto>> Handle(CreateRoleCommand cmd, CancellationToken ct)
    {
        if (await roleRepo.NameExistsAsync(cmd.Name, null, ct))
            return Result.Failure<RoleDto>(Error.Custom("Role.Name.Taken", $"A role named '{cmd.Name}' already exists."));

        var result = Domain.Entities.Role.Create(cmd.Name, cmd.Description);
        if (result.IsFailure) return Result.Failure<RoleDto>(result.Error);

        var role  = result.Value;
        var perms = await permissionRepo.GetByIdsAsync(cmd.PermissionIds ?? [], ct);
        role.SetPermissions(perms.Select(p => p.Id));

        roleRepo.Add(role);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new RoleDto(
            role.Id, role.Name, role.Description, role.IsSystem, 0,
            perms.Select(p => new PermissionDto(p.Id, p.ModuleId, p.Action, p.Description, p.Key)).ToList()
        ));
    }
}
