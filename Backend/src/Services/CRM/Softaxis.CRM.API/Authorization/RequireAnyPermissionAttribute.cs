using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.CRM.API.Authorization;

/// <summary>
/// Passes when the current user holds <b>any one</b> of the given permission keys (or is a super admin).
/// Used where an endpoint serves two access tiers — e.g. lead reads allowed for both full
/// <c>crm.leads.view</c> and assigned-only <c>crm.leads-assigned.view</c>; the handler then narrows
/// the data to what the caller may actually see. Same 403 shape as <see cref="RequirePermissionAttribute"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public sealed class RequireAnyPermissionAttribute(params string[] permissions) : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;

        if (user.FindFirstValue("is_super_admin") == "true") return;
        if (permissions.Any(p => user.HasClaim("permission", p))) return;

        context.Result = new ObjectResult(new
        {
            Code = "Permission.Denied",
            Description = $"Missing permission: one of [{string.Join(", ", permissions)}]",
        })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
