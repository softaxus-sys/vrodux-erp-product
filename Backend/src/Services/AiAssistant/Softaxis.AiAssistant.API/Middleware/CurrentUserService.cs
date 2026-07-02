using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.API.Middleware;

/// <summary>
/// Resolves the authenticated caller from the current HTTP request. Also exposes the raw bearer
/// token and the request's own scheme+host so tools can call the ERP API back as this user.
/// </summary>
public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    private HttpContext? Ctx => accessor.HttpContext;
    private ClaimsPrincipal? Principal => Ctx?.User;

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

    public string? BearerToken
    {
        get
        {
            var header = Ctx?.Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(header)) return null;
            const string prefix = "Bearer ";
            return header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                ? header[prefix.Length..].Trim()
                : header.Trim();
        }
    }

    public string? RequestBaseUrl
    {
        get
        {
            var req = Ctx?.Request;
            return req is null ? null : $"{req.Scheme}://{req.Host.Value}";
        }
    }
}
