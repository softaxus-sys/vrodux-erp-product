using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Roles.Commands.UpdateRolePermissions;

/// <summary>Replaces all permissions on a role with the supplied set.</summary>
public sealed record UpdateRolePermissionsCommand(Guid RoleId, List<Guid> PermissionIds) : ICommand<RoleDto>;
