namespace Softaxis.Fitness.Application.Abstractions;

/// <summary>The signed-in staff member, read from the JWT by the host.</summary>
public interface ICurrentUser
{
    Guid? Id { get; }
    string? Name { get; }
    bool IsSuperAdmin { get; }
    bool HasPermission(string permissionKey);
}

public static class FitnessPermissions
{
    public static bool Any(this ICurrentUser user, params string[] keys) =>
        user.IsSuperAdmin || keys.Any(user.HasPermission);
}
