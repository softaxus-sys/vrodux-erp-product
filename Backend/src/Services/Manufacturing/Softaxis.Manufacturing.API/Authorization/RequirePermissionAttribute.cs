using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.Manufacturing.API.Authorization;

/// <summary>
/// Requires the current user to hold at least one of the given permission keys
/// (e.g. "manufacturing.orders.edit") as a "permission" claim, or to be a super admin.
/// </summary>
public sealed class RequirePermissionAttribute(params string[] anyOf) : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.FindFirstValue("is_super_admin") == "true") return;
        if (anyOf.Any(p => user.HasClaim("permission", p))) return;

        context.Result = new ObjectResult(new
        {
            Code        = "Permission.Denied",
            Description = $"Missing permission: {string.Join(" or ", anyOf)}",
        })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
