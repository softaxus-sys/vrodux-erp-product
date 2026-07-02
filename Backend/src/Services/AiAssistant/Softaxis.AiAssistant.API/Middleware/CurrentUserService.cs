using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.AiAssistant.Application.Abstractions;

namespace Softaxis.AiAssistant.API.Middleware;

/// <summary>
/// Resolves the caller. Normally from the authenticated HTTP request (JWT claims + bearer). When an
/// <see cref="AiImpersonation"/> context is active (an inbound Telegram message from a linked user),
/// it takes precedence — so tools still run tenant- and permission-scoped for the linked user.
/// </summary>
public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    private HttpContext? Ctx => accessor.HttpContext;
    private ClaimsPrincipal? Principal => Ctx?.User;

    public Guid? Id
    {
        get
        {
            if (AiImpersonation.Current is { } imp) return imp.Id;
            var val = Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? Principal?.FindFirstValue("sub");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    public string? Username => AiImpersonation.Current?.Username
        ?? Principal?.FindFirstValue(ClaimTypes.Name) ?? Principal?.FindFirstValue("preferred_username");

    public string? Email => AiImpersonation.Current?.Email
        ?? Principal?.FindFirstValue(ClaimTypes.Email) ?? Principal?.FindFirstValue("email");

    public bool IsSuperAdmin =>
        AiImpersonation.Current?.IsSuperAdmin ?? (Principal?.FindFirstValue("is_super_admin") == "true");

    public bool HasPermission(string permissionKey) =>
        AiImpersonation.Current is { } imp
            ? imp.Permissions.Contains(permissionKey)
            : Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;

    public string? BearerToken
    {
        get
        {
            if (AiImpersonation.Current is { } imp) return imp.BearerToken;
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
            if (AiImpersonation.Current is { } imp) return imp.BaseUrl;
            var req = Ctx?.Request;
            return req is null ? null : $"{req.Scheme}://{req.Host.Value}";
        }
    }
}
