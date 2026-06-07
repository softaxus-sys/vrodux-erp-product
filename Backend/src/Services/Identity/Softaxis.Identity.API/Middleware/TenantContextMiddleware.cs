using System.Security.Claims;
using Softaxis.Identity.Infrastructure.Services;

namespace Softaxis.Identity.API.Middleware;

/// <summary>
/// Resolves TenantContextService from JWT claims after authentication.
/// Must run after UseAuthentication() but before controller execution.
/// </summary>
public sealed class TenantContextMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TenantContextService tenantContext)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var principal = context.User;

            Guid? tenantId = Guid.TryParse(principal.FindFirstValue("tenant_id"), out var tid)
                ? tid : null;

            var tenantSlug   = principal.FindFirstValue("tenant_slug");
            var tenantName   = principal.FindFirstValue("tenant_name");
            var plan         = principal.FindFirstValue("plan");
            var isSuperAdmin = principal.FindFirstValue("is_super_admin") == "true";
            var modulesCsv   = principal.FindFirstValue("modules");

            tenantContext.Resolve(tenantId, tenantSlug, tenantName, plan, isSuperAdmin, modulesCsv);
        }

        await next(context);
    }
}
