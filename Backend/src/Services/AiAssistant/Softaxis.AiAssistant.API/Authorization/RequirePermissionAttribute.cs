using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.AiAssistant.API.Authorization;

/// <summary>
/// Requires the current user to hold the given permission key (e.g. "settings.ai.edit") as a
/// "permission" claim, or to be a super admin. Returns 403 with a { Code, Description } body.
/// Mirrors the pattern used by CRM / ProjectManagement.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class RequirePermissionAttribute(string permission) : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.FindFirstValue("is_super_admin") == "true") return;
        if (user.HasClaim("permission", permission)) return;

        context.Result = new ObjectResult(new { Code = "Permission.Denied", Description = $"Missing permission: {permission}" })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
