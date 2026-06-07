using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Application.Common;

/// <summary>
/// Central tenant-ownership guard for per-entity operations.
/// Super-admins may act on any record; everyone else is confined to their own tenant.
/// </summary>
public static class TenantOwnership
{
    /// <summary>
    /// True if the caller may access a record owned by <paramref name="targetTenantId"/>.
    /// Super-admin → always. Tenant user → only their own tenant's records.
    /// </summary>
    public static bool CanAccess(ICurrentUser currentUser, ITenantContext tenant, System.Guid? targetTenantId)
        => currentUser.IsSuperAdmin
           || (tenant.TenantId.HasValue && targetTenantId == tenant.TenantId);
}
