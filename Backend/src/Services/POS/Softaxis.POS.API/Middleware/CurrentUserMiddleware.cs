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

    public string? Username => Principal?.FindFirstValue(ClaimTypes.Name)
                            ?? Principal?.FindFirstValue("preferred_username");

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
