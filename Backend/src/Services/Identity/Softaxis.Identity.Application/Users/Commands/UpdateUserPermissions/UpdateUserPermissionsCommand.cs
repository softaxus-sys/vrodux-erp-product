using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.Identity.Application.Users.Commands.UpdateUserPermissions;

/// <summary>
/// Replace the full set of per-user permission overrides for a user.
/// Each item is a (PermissionId, IsGranted) pair — IsGranted=true grants an extra permission
/// beyond the user's roles, IsGranted=false explicitly denies a role-granted permission.
/// An empty list clears all overrides (revert to pure role permissions).
/// </summary>
public sealed record UpdateUserPermissionsCommand(
    Guid UserId,
    IReadOnlyList<PermissionOverrideInput> Overrides
) : ICommand<UserDto>;

public sealed record PermissionOverrideInput(Guid PermissionId, bool IsGranted);
