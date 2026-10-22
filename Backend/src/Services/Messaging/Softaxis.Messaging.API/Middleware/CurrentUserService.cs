using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Messaging.Application.Abstractions;

namespace Softaxis.Messaging.API.Middleware;

/// <summary>Reads the signed-in user from the request's JWT claims.</summary>
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

    public string? Name =>
        Principal?.FindFirstValue(ClaimTypes.Name) ?? Principal?.FindFirstValue("name") ?? Principal?.FindFirstValue(ClaimTypes.Email);

    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public bool HasPermission(string permissionKey) =>
        Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
