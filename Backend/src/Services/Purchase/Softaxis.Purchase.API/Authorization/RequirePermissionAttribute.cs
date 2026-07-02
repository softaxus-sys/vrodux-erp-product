using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.Purchase.API.Authorization;

/// <summary>
/// Requires the current user to hold the given permission key (e.g. "purchase.orders.create")
/// as a "permission" claim, or to be a super admin. Returns 403 with the same
/// <c>{ Code, Description }</c> error shape used elsewhere in the Purchase API.
/// Effective permissions (role ∪ user-grants − user-denies) are computed in Identity and embedded
/// in the JWT, so this filter only has to read the claims.
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
