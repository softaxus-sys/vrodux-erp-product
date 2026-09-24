using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Seo.Application.Abstractions;

namespace Softaxis.Seo.API.Middleware;

public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? Id
    {
        get
        {
            var val = Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? Principal?.FindFirstValue("sub");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    // JwtTokenService emits the username under a plain "username" claim — never ClaimTypes.Name
    // or "preferred_username" (neither is ever set).
    public string? Username => Principal?.FindFirstValue("username");

    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email) ?? Principal?.FindFirstValue("email");

    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public Guid? TenantId
    {
        get
        {
            var val = Principal?.FindFirstValue("tenant_id");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
