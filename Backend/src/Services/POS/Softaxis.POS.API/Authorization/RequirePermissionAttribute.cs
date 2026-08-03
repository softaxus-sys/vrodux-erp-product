using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.POS.API.Authorization;

/// <summary>
/// Requires the current user to hold the given permission key (e.g. "pos.customers.edit") as a
/// "permission" claim, or to be a super admin. Returns 403 with the same
/// <c>{ Code, Description }</c> error shape used elsewhere in the API. Copy of the shared pattern
/// already used in Finance/HR/Restaurant/CRM/etc — POS itself has no per-permission enforcement
/// anywhere yet (only `[Authorize]`); this attribute is applied only to the new wallet/house-account
/// endpoints, not retrofitted onto the rest of POS.
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
