namespace Softaxis.RealEstate.Application.Abstractions;

/// <summary>
/// The authenticated user behind the current request, read from the JWT claims.
/// Effective permissions (role ∪ user-grants − user-denies) are computed in Identity and
/// embedded in the token, so <see cref="HasPermission"/> only reads claims.
///
/// <para>First use in this service — introduced for the Listings confidentiality guard, which needs
/// to know whether the caller is the listing's own assigned agent, not just whether their role
/// carries a flat permission key.</para>
/// </summary>
public interface ICurrentUser
{
    Guid?   Id           { get; }
    string? Username     { get; }
    string? Email        { get; }
    bool    IsSuperAdmin { get; }
    bool    HasPermission(string permissionKey);
}
