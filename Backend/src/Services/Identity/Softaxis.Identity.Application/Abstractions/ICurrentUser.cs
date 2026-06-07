namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// Abstraction over the currently authenticated user.
/// Implemented in the API layer via HttpContext claims.
/// </summary>
public interface ICurrentUser
{
    Guid?    Id           { get; }
    string?  Email        { get; }
    string?  Username     { get; }
    bool     IsAuthenticated { get; }

    // ── Tenant / plan context ─────────────────────────────────────────────────
    Guid?    TenantId     { get; }
    string?  TenantSlug   { get; }
    string?  TenantName   { get; }
    string?  Plan         { get; }
    bool     IsSuperAdmin { get; }

    IReadOnlyList<string> Permissions { get; }
    bool HasPermission(string permissionKey);
}
