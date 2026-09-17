namespace Softaxis.Support.Application.Abstractions;

/// <summary>
/// The authenticated caller behind the current request, read from JWT claims — including the
/// caller's OWN tenant identity. Support is a cross-tenant module by design, so unlike every
/// other service's <c>ICurrentUser</c>, this one also exposes <see cref="TenantId"/> and
/// <see cref="TenantName"/> directly off the token (already present as the standard
/// <c>tenant_id</c>/<c>tenant_name</c> claims) rather than relying on the ambient tenant context
/// that drives normal per-tenant data isolation — this service deliberately does not use that.
/// </summary>
public interface ICurrentUser
{
    Guid?   Id           { get; }
    string? Username     { get; }
    string? Email        { get; }
    bool    IsSuperAdmin { get; }
    Guid?   TenantId     { get; }
    string? TenantName   { get; }
    bool    HasPermission(string permissionKey);
}
