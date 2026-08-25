using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Common;

/// <summary>
/// Single source of truth for projecting a <see cref="User"/> aggregate to a <see cref="UserDto"/>,
/// including role permissions and per-user permission overrides. Requires the user to be loaded with
/// UserRoles → Role → RolePermissions → Permission and UserPermissions → Permission
/// (see <c>UserRepository.BaseQuery</c>).
/// </summary>
public static class UserDtoMapper
{
    public static UserDto ToDto(User user) =>
        new(
            user.Id, user.Email.Value, user.Username,
            user.FirstName, user.LastName, user.FullName,
            user.Status.ToString(), user.EmailVerified,
            user.AvatarUrl, user.PhoneNumber, user.LastLoginAt, user.CreatedAt,
            user.UserRoles.Select(ur => new RoleDto(
                ur.Role.Id, ur.Role.Name, ur.Role.Description,
                ur.Role.IsSystem, ur.Role.UserRoles.Count,
                ur.Role.RolePermissions.Select(rp => new PermissionDto(
                    rp.Permission.Id, rp.Permission.ModuleId,
                    rp.Permission.Action, rp.Permission.Description,
                    rp.Permission.Key)).ToList()
            )).ToList(),
            user.UserPermissions.Select(up => new PermissionOverrideDto(
                up.PermissionId,
                up.Permission.ModuleId + "." + up.Permission.Action,
                up.IsGranted)).ToList(),
            user.MustChangePassword
        );
}
