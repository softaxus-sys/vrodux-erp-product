using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Support.Application.Abstractions;

namespace Softaxis.Support.API.Middleware;

/// <summary>
/// Reads the authenticated user AND their own tenant identity from the current request's JWT
/// claims. Support is a cross-tenant module, so unlike most services' CurrentUserService this
/// one also surfaces TenantId/TenantName — both already standard claims on every token
/// (JwtTokenService), never a second lookup.
/// </summary>
public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? Id
    {
        get
        {
            var val = Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? Principal?.FindFirstValue("sub");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    public string? Username => Principal?.FindFirstValue(ClaimTypes.Name)
                            ?? Principal?.FindFirstValue("preferred_username");

    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email)
                         ?? Principal?.FindFirstValue("email");

    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public Guid? TenantId
    {
        get
        {
            var val = Principal?.FindFirstValue("tenant_id");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    public string? TenantName => Principal?.FindFirstValue("tenant_name");

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
