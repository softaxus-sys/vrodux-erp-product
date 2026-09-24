using System.Security.Claims;
using Softaxis.POS.Application.Abstractions;

namespace Softaxis.POS.API.Middleware;

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

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public string? Country => Principal?.FindFirstValue("country");

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
