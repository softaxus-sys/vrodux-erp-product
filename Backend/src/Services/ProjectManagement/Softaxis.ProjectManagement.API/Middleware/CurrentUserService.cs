using System.Security.Claims;
using Softaxis.ProjectManagement.Application.Abstractions;

namespace Softaxis.ProjectManagement.API.Middleware;

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

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
