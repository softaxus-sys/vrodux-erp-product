using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.Support.API.Authorization;

/// <summary>
/// Requires the current user to hold the given permission key (e.g. "support.tickets.edit")
/// as a "permission" claim, or to be a super admin. Same pattern as every other service's
/// RequirePermissionAttribute.
///
/// Note this is deliberately the ONLY gate at the HTTP layer — it does not, and cannot, know
/// whether the caller's own tenant is the Softaxis operator tenant. That second check
/// (ISupportAccessGuard) lives in the handlers, because a permission claim is not, on its own,
/// treated as sufficient proof for a cross-tenant action in this service.
/// </summary>
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
