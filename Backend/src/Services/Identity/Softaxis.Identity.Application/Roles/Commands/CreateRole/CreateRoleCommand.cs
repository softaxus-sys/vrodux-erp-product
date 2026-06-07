using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Roles.Commands.CreateRole;

public sealed record CreateRoleCommand(
    string      Name,
    string      Description,
    List<Guid>? PermissionIds = null
) : ICommand<RoleDto>;
