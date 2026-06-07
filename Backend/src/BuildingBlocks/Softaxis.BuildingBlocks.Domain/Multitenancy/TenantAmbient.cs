namespace Softaxis.BuildingBlocks.Domain.Multitenancy;

/// <summary>
/// Ambient per-request tenant, stored in an <see cref="AsyncLocal{T}"/> so it flows
/// through async calls. Set once per request by host middleware (from the JWT) and
/// read by DbContext global query filters + insert stamping.
///
/// Why ambient/static instead of an injected service: EF Core caches the model once
/// per context type, so a query filter that captured an injected provider instance
/// would freeze the first request's tenant. Static member access in the filter is
/// re-evaluated per query, giving correct per-request scoping.
/// </summary>
public static class TenantAmbient
{
    private sealed record State(bool IsResolved, bool IsSuperAdmin, Guid? TenantId);

    private static readonly AsyncLocal<State?> _current = new();

    public static void Set(Guid? tenantId, bool isSuperAdmin, bool isResolved)
        => _current.Value = new State(isResolved, isSuperAdmin, tenantId);

    public static void Clear() => _current.Value = null;

    public static bool IsResolved   => _current.Value?.IsResolved ?? false;
    public static bool IsSuperAdmin => _current.Value?.IsSuperAdmin ?? false;
    public static Guid? TenantId    => _current.Value?.TenantId;

    /// <summary>True when the tenant filter should be bypassed (unresolved context or super-admin).</summary>
    public static bool BypassFilter => !IsResolved || IsSuperAdmin;
}
