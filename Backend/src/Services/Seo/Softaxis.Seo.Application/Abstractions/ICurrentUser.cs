namespace Softaxis.Seo.Application.Abstractions;

/// <summary>Reads the authenticated user from the current request's JWT claims. Same shape as
/// every other service's ICurrentUser.</summary>
public interface ICurrentUser
{
    Guid?   Id       { get; }
    string? Username { get; }
    string? Email    { get; }
    bool    IsSuperAdmin { get; }
    Guid?   TenantId { get; }

    bool HasPermission(string permissionKey);
}
