using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Library.Application.Abstractions;

namespace Softaxis.Library.API.Middleware;

/// <summary>
/// Reads the authenticated user from the current request's JWT claims.
/// Same pattern as the other services.
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

    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
