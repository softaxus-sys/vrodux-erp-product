using System.Security.Claims;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.API.Middleware;

/// <summary>
/// Populates ICurrentUser from JWT claims so application handlers can access
/// the caller's identity without depending on HttpContext directly.
/// </summary>
public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid?   Id       => Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ??
                                             Principal?.FindFirstValue("sub"), out var id) ? id : null;
    public string? Email    => Principal?.FindFirstValue(ClaimTypes.Email) ?? Principal?.FindFirstValue("email");
    public string? Username => Principal?.FindFirstValue("username");
    public bool    IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid?   TenantId   => Guid.TryParse(Principal?.FindFirstValue("tenant_id"), out var tid) ? tid : null;
    public string? TenantSlug => Principal?.FindFirstValue("tenant_slug");
    public string? TenantName => Principal?.FindFirstValue("tenant_name");
    public string? Plan       => Principal?.FindFirstValue("plan");
    public bool    IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public IReadOnlyList<string> Permissions =>
        Principal?.FindAll("permission").Select(c => c.Value).ToList() ?? [];

    public bool HasPermission(string permissionKey) =>
        Permissions.Contains(permissionKey, StringComparer.OrdinalIgnoreCase);
}
