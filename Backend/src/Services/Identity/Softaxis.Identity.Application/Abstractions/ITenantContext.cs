using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;

namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// Resolved per-request from JWT claims. Provides tenant identity + plan limits
/// for enforcement in command handlers and business logic.
/// </summary>
public interface ITenantContext
{
    bool        IsResolved   { get; }
    Guid?       TenantId     { get; }
    string?     TenantSlug   { get; }
    string?     TenantName   { get; }
    PlanType?   Plan         { get; }
    PlanLimits? Limits       { get; }
    bool        IsSuperAdmin { get; }

    /// <summary>
    /// Resolved module list from the JWT "modules" claim.
    /// Falls back to plan-default modules when the claim is absent.
    /// Empty for super-admins (they bypass module checks entirely).
    /// </summary>
    IReadOnlyList<string> Modules { get; }
}
