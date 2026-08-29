using System.Security.Claims;
using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.ApiGateway.Middleware;

/// <summary>
/// Publishes the authenticated request's tenant into <see cref="TenantAmbient"/>
/// (AsyncLocal) so every service DbContext can auto-stamp inserts and apply the
/// tenant global query filter. Must run AFTER UseAuthentication().
/// </summary>
public sealed class TenantAmbientMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var isSuper  = user.FindFirstValue("is_super_admin") == "true";
            Guid? tenant = Guid.TryParse(user.FindFirstValue("tenant_id"), out var id) ? id : null;
            // The tenant's operating currency (Module 6e) rides on the same token, so newly
            // created records can be stamped with it instead of the historical "AED" default.
            var currency = user.FindFirstValue("currency");
            TenantAmbient.Set(tenant, isSuper, isResolved: true, currency);
        }
        else
        {
            TenantAmbient.Clear();
        }

        try
        {
            await next(context);
        }
        finally
        {
            TenantAmbient.Clear();
        }
    }
}
