using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Softaxis.POS.API.Authorization;

/// <summary>
/// Passes when the user holds ANY of the given permission keys (or is a super admin).
/// Mirrors the CRM/HR pattern.
///
/// POS needs this because a till action is legitimately reachable from two different tiers: a
/// Cashier opens and closes their OWN shift, while a Supervisor may act on anyone's. The Cashier
/// role holds <c>pos.transactions.create</c> but not <c>pos.sessions.create</c>, so gating those
/// endpoints on a single key would lock the primary operator out of their own till. The attribute
/// is the coarse "may this user operate a till at all" gate; the handler still decides whether
/// THIS session is theirs to touch.
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
            Code        = "Permission.Denied",
            Description = $"Missing permission: one of {string.Join(", ", permissions)}",
        })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
