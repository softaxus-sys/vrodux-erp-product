using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.HR.API.Authorization;

/// <summary>
/// Passes when the current user holds <b>any one</b> of the given permission keys (or is a super admin).
/// Used where an endpoint serves two roles — payroll reads and edits are open to both HR
/// (<c>hr.payroll.*</c>) and the Finance approver (<c>finance.payroll.approve</c>), who has no HR
/// permissions at all. Same 403 shape as <see cref="RequirePermissionAttribute"/>.
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
