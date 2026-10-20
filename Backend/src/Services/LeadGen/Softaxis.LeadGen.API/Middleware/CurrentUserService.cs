using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Softaxis.LeadGen.Application.Abstractions;

namespace Softaxis.LeadGen.API.Middleware;

/// <summary>Reads the authenticated user from the current request's JWT claims. Same pattern as the other services.</summary>
public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid? Id
    {
        get
        {
            var val = Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? Principal?.FindFirstValue("sub");
            return Guid.TryParse(val, out var id) ? id : null;
        }
    }

    public string? Name =>
        Principal?.FindFirstValue(ClaimTypes.Name) ?? Principal?.FindFirstValue("name") ?? Principal?.FindFirstValue(ClaimTypes.Email);

    public Guid? TenantId => Guid.TryParse(Principal?.FindFirstValue("tenant_id"), out var id) ? id : null;

    public bool IsSuperAdmin => Principal?.FindFirstValue("is_super_admin") == "true";

    public string? SubscriptionState => Principal?.FindFirstValue("subscription_state");

    public bool HasPermission(string permissionKey) =>
        IsSuperAdmin || Principal?.FindAll("permission").Any(c => c.Value == permissionKey) == true;

    /// <summary>The "modules" claim is one comma-joined string, set at login from the tenant's resolved modules.</summary>
    public bool HasModule(string module)
    {
        if (IsSuperAdmin) return true;
        var csv = Principal?.FindFirstValue("modules");
        return !string.IsNullOrWhiteSpace(csv)
               && csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                     .Any(m => string.Equals(m, module, StringComparison.OrdinalIgnoreCase));
    }
}
