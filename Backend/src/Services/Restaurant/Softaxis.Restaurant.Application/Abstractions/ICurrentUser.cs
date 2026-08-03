namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// The authenticated user behind the current request, read from the JWT claims.
/// Effective permissions (role ∪ user-grants − user-denies) are computed in Identity and
/// embedded in the token, so <see cref="HasPermission"/> only reads claims.
/// </summary>
public interface ICurrentUser
{
    Guid?   Id           { get; }
    string? Username     { get; }
    string? Email        { get; }
    bool    IsSuperAdmin { get; }
    bool    HasPermission(string permissionKey);
}
