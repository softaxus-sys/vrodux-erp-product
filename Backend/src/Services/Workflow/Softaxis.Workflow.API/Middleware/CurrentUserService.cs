using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.Workflow.Application;

namespace Softaxis.Workflow.API.Middleware;

/// <summary>Reads the authenticated user from the current request's JWT claims.</summary>
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

    /// <summary>
    /// The person's full name. Vrodux sign-in tokens carry firstName / lastName rather than a single name claim, so
    /// those come first; the email is the last resort so a name is never empty.
    /// </summary>
    public string? Name
    {
        get
        {
            var full = $"{Principal?.FindFirstValue("firstName")} {Principal?.FindFirstValue("lastName")}".Trim();
            return full.Length > 0 ? full
                : Principal?.FindFirstValue(ClaimTypes.Name) ?? Principal?.FindFirstValue("name") ?? Principal?.FindFirstValue(ClaimTypes.Email);
        }
    }
    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email) ?? Principal?.FindFirstValue("email");
    public string? Ip => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";
    public bool HasPermission(string permissionKey) => Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;
}
