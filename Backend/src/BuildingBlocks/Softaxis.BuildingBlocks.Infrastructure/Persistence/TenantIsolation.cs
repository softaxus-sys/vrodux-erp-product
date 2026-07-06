using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.BuildingBlocks.Infrastructure.Persistence;

/// <summary>
/// Reusable row-level tenant isolation for any DbContext, using a shadow
/// <c>TenantId</c> column (no entity-class changes required):
///   • <see cref="ApplyTenantId{TContext}(ModelBuilder, TContext, string, string)"/> adds the shadow
///     column + a global query filter that scopes reads to the current ambient tenant
///     (super-admin / unresolved bypass).
///   • <see cref="StampTenantId"/> sets TenantId on inserts from the ambient tenant.
///
/// The filter references the <see cref="ITenantAmbientContext"/> <b>instance</b> members of the
/// owning DbContext (NOT the <see cref="TenantAmbient"/> statics). EF Core re-roots a DbContext
/// instance reference in a query filter to the current request's context and re-evaluates it per
/// query — whereas a static reference is evaluated once and baked into the cached compiled query,
/// causing the first tenant's value to leak into every later request. See <see cref="ITenantAmbientContext"/>.
/// </summary>
public static class TenantIsolation
{
    public const string Column = "TenantId";

    private static readonly System.Reflection.PropertyInfo BypassProp =
        typeof(ITenantAmbientContext).GetProperty(nameof(ITenantAmbientContext.BypassTenantFilter))!;
    private static readonly System.Reflection.PropertyInfo TenantIdProp =
        typeof(ITenantAmbientContext).GetProperty(nameof(ITenantAmbientContext.CurrentTenantId))!;

    /// <summary>
    /// Convenience overload: isolate every mapped entity (with a primary key, not owned)
    /// whose CLR namespace starts with <paramref name="domainNamespacePrefix"/>.
    /// Call at the END of OnModelCreating (after all mappings). <paramref name="context"/> is the
    /// owning DbContext (pass <c>this</c>) — its instance members drive the per-query tenant scope.
    /// </summary>
    public static void ApplyTenantId<TContext>(ModelBuilder modelBuilder, TContext context, string domainNamespacePrefix, string column = Column)
        where TContext : DbContext, ITenantAmbientContext
        => ApplyTenantId(modelBuilder, context, domainNamespacePrefix, exclude: null, column);

    /// <summary>
    /// Namespace overload with an opt-out set: entity types in <paramref name="exclude"/> are left
    /// out of tenant isolation (no shadow TenantId, no tenant query filter) — use for GLOBAL reference
    /// data shared across all tenants (e.g. currency masters, market exchange rates).
    /// </summary>
    public static void ApplyTenantId<TContext>(ModelBuilder modelBuilder, TContext context, string domainNamespacePrefix, IEnumerable<Type>? exclude, string column = Column)
        where TContext : DbContext, ITenantAmbientContext
    {
        var excluded = exclude is null ? null : new HashSet<Type>(exclude);
        var types = modelBuilder.Model.GetEntityTypes()
            .Where(t => !t.IsOwned() && t.FindPrimaryKey() != null
                     && t.ClrType.Namespace?.StartsWith(domainNamespacePrefix) == true
                     && (excluded is null || !excluded.Contains(t.ClrType)))
            .Select(t => t.ClrType).Distinct().ToList();
        ApplyTenantId(modelBuilder, context, types, column);
    }

    public static void ApplyTenantId<TContext>(ModelBuilder modelBuilder, TContext context, IEnumerable<Type> entityTypes, string column = Column)
        where TContext : DbContext, ITenantAmbientContext
    {
        foreach (var clr in entityTypes)
        {
            var entity = modelBuilder.Entity(clr);
            entity.Property<Guid?>(column);
            entity.HasIndex(column);

            // e => context.BypassTenantFilter
            //      || (context.CurrentTenantId != null && EF.Property<Guid?>(e, column) == context.CurrentTenantId)
            //
            // `context` is a reference to the owning DbContext instance. EF Core re-roots it to the
            // CURRENT request's context and re-evaluates BypassTenantFilter/CurrentTenantId per query,
            // giving correct per-request scoping (a static reference would be baked once → leak).
            //
            // The `ambient != null` guard is critical: a resolved-but-tenant-less non-super user
            // (CurrentTenantId == null) must match NOTHING. Without it, `row.TenantId == null` would
            // let such a context see every legacy/demo row inserted with TenantId = NULL. NULL-tenant
            // rows are visible ONLY to super-admins (via bypass).
            var e = Expression.Parameter(clr, "e");

            var ctx      = Expression.Constant(context, typeof(TContext));
            var bypass   = Expression.Property(ctx, BypassProp);
            var ambient  = Expression.Property(ctx, TenantIdProp);
            var rowValue = Expression.Call(
                typeof(EF), nameof(EF.Property), [typeof(Guid?)],
                e, Expression.Constant(column));

            var ambientHasValue = Expression.NotEqual(ambient, Expression.Constant(null, typeof(Guid?)));
            var matches = Expression.AndAlso(ambientHasValue, Expression.Equal(rowValue, ambient));
            var body = Expression.OrElse(bypass, matches);
            entity.HasQueryFilter(Expression.Lambda(body, e));
        }
    }

    /// <summary>Stamp the tenant column on newly-added rows from the ambient tenant.</summary>
    public static void StampTenantId(ChangeTracker changeTracker, string column = Column)
    {
        if (!TenantAmbient.IsResolved || !TenantAmbient.TenantId.HasValue) return;
        var tenantId = TenantAmbient.TenantId.Value;

        foreach (var entry in changeTracker.Entries())
        {
            if (entry.State != EntityState.Added) continue;
            if (entry.Metadata.FindProperty(column) is null) continue;
            if (entry.Property(column).CurrentValue is null)
                entry.Property(column).CurrentValue = tenantId;
        }
    }
}
