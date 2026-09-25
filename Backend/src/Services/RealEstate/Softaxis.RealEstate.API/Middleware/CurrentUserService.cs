using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.RealEstate.Application.Abstractions;

namespace Softaxis.RealEstate.API.Middleware;

/// <summary>
/// Reads the authenticated user from the current request's JWT claims.
/// Mirrors CRM/ProjectManagement's implementation — the codebase's standard pattern.
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

    // JwtTokenService emits the username under a plain "username" claim — never ClaimTypes.Name
    // or "preferred_username" (neither is ever set), so those always resolved null.
    public string? Username => Principal?.FindFirstValue("username");

    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email)
                         ?? Principal?.FindFirstValue("email");

    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
