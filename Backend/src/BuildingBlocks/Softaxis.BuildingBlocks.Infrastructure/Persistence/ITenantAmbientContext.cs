using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.BuildingBlocks.Infrastructure.Persistence;

/// <summary>
/// Implemented by every tenant-isolated <c>DbContext</c>. The tenant global query filter
/// (see <see cref="TenantIsolation"/>) references these <b>instance</b> members rather than the
/// <see cref="TenantAmbient"/> statics directly.
///
/// <para><b>Why instance members, not statics:</b> EF Core evaluates a <i>static</i> member
/// referenced inside a query filter <b>once</b> and bakes the value into the cached compiled query.
/// Whichever tenant's request first compiles a given query then "owns" it — every later request
/// reuses that cached query and sees the first tenant's rows (a cross-tenant leak). EF Core
/// re-roots a reference to the <b>DbContext instance</b> to the <i>current</i> request's context and
/// re-evaluates its members per query, which is exactly what tenant scoping requires.</para>
///
/// Default implementations read the ambient tenant, so an isolated context only needs to add the
/// interface to its declaration — no body required.
/// </summary>
public interface ITenantAmbientContext
{
    /// <summary>The current request's tenant (null = unresolved / super-admin).</summary>
    Guid? CurrentTenantId => TenantAmbient.TenantId;

    /// <summary>True when the tenant filter should be bypassed (unresolved context or super-admin).</summary>
    bool BypassTenantFilter => TenantAmbient.BypassFilter;
}
