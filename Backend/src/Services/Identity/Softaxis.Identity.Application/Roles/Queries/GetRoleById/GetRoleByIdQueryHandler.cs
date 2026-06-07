using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Roles.Queries.GetRoleById;

public sealed class GetRoleByIdQueryHandler(IRoleRepository roleRepo)
    : IQueryHandler<GetRoleByIdQuery, RoleDto>
{
    public async Task<Result<RoleDto>> Handle(GetRoleByIdQuery query, CancellationToken ct)
    {
        var role = await roleRepo.GetByIdAsync(query.Id, ct);
        if (role is null) return Result.Failure<RoleDto>(Error.NotFoundById("Role", query.Id));

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
