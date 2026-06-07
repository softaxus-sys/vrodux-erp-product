using System.Text.Json;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.ApiGateway.Middleware;

/// <summary>
/// Enforces module-level access control at the API gateway.
///
/// Each service has a URL prefix (e.g. "/api/inventory/") mapped to a required
/// module code (e.g. "inventory.basic").  When an authenticated tenant user
/// hits a module-gated route, their resolved module list (from the JWT "modules"
/// claim) is checked via <see cref="ModuleCodes.HasAccess"/>.
///
/// Super-admins bypass all module checks.
/// Unauthenticated / no-tenant requests pass through (let auth pipeline decide).
/// Routes not listed in <see cref="RouteModuleMap"/> are not enforced.
/// </summary>
public sealed class ModuleEnforcementMiddleware(RequestDelegate next)
{
    // ── Route → required module code ─────────────────────────────────────────
    // Key: URL path prefix (lower-case, ends with "/" to avoid false matches).
    // Value: minimum required module code (checked via ModuleCodes.HasAccess).
    private static readonly IReadOnlyDictionary<string, string> RouteModuleMap =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            // ── Core modules ──────────────────────────────────────────────────
            ["/api/inventory/"]    = ModuleCodes.InventoryBasic,  // inventory or inventory.basic
            ["/api/hr/"]           = ModuleCodes.HrBasic,          // hr or hr.basic
            ["/api/finance/"]      = ModuleCodes.Finance,
            ["/api/purchase/"]     = ModuleCodes.Purchasing,
            ["/api/crm/"]          = ModuleCodes.CrmBasic,          // crm or crm.basic
            ["/api/sales/"]        = ModuleCodes.Sales,             // dedicated, independently-licensed module
            ["/api/pos/"]          = ModuleCodes.Pos,
            ["/api/restaurant/"]   = ModuleCodes.Pos,
            ["/api/recipes"]       = ModuleCodes.Pos,

            // ── Industry packs (tenant.Industry → pack code, folded into modules) ──
            ["/api/real-estate/"]  = ModuleCodes.RealEstate,
            ["/api/construction/"] = ModuleCodes.Construction,
            ["/api/healthcare/"]   = ModuleCodes.Healthcare,
            ["/api/education/"]    = ModuleCodes.Education,
            ["/api/insurance/"]    = ModuleCodes.Insurance,
            ["/api/b2b/"]          = ModuleCodes.B2B,

            // ── Shared master-data reference endpoints (mirror frontend gating) ──
            ["/api/categories"]      = ModuleCodes.Pos,         // POS categories
            ["/api/customers"]       = ModuleCodes.CrmBasic,    // customer master
            ["/api/customer-groups"] = ModuleCodes.CrmBasic,
            ["/api/vendors"]         = ModuleCodes.Purchasing,
            ["/api/currencies"]      = ModuleCodes.Finance,
            ["/api/tax-rates"]       = ModuleCodes.Finance,
            ["/api/payment-terms"]   = ModuleCodes.Finance,
        };

    // Paths that always bypass enforcement
    private static readonly string[] BypassPrefixes =
    [
        "/health",
        "/api/auth/",
        "/api/admin/",      // super-admin management (gated separately by SuperAdminOnly policy)
        "/api/license/",
        "/openapi",
        "/scalar",
    ];

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantCtx)
    {
        // Super-admins see everything
        if (tenantCtx.IsSuperAdmin)
        {
            await next(context);
            return;
        }

        // Not authenticated / no tenant — let the auth pipeline decide
        if (!tenantCtx.IsResolved || !tenantCtx.TenantId.HasValue)
        {
            await next(context);
            return;
        }

        var path = context.Request.Path.Value ?? string.Empty;

        // Always-bypass paths
        foreach (var prefix in BypassPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                await next(context);
                return;
            }
        }

        // Find the first matching route prefix in the map
        string? requiredModule = null;
        foreach (var (prefix, module) in RouteModuleMap)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                requiredModule = module;
                break;
            }
        }

        // No module rule for this route — pass through
        if (requiredModule is null)
        {
            await next(context);
            return;
        }

        // Check tenant modules
        if (ModuleCodes.HasAccess(tenantCtx.Modules, requiredModule))
        {
            await next(context);
            return;
        }

        // Module not licensed — reject
        context.Response.StatusCode  = 403;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            success   = false,
            errorCode = "MODULE_NOT_LICENSED",
            message   = $"Your plan does not include access to the '{requiredModule}' module.",
        }));
    }
}
