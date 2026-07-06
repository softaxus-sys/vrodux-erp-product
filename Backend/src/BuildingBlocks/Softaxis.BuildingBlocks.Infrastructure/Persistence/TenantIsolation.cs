using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Softaxis.BuildingBlocks.Domain.Multitenancy;

namespace Softaxis.BuildingBlocks.Infrastructure.Persistence;

/// <summary>
/// Reusable row-level tenant isolation for any DbContext, using a shadow
/// <c>TenantId</c> column (no entity-class changes required):
///   • <see cref="ApplyTenantId"/> adds the shadow column + a global query filter
///     that scopes reads to the current ambient tenant (super-admin / unresolved bypass).
///   • <see cref="StampTenantId"/> sets TenantId on inserts from the ambient tenant.
///
/// The filter reads <see cref="TenantAmbient"/> static members so it is re-evaluated
/// per query (EF caches the model once per context type).
/// </summary>
public static class TenantIsolation
{
    public const string Column = "TenantId";

    private static readonly System.Reflection.PropertyInfo BypassProp =
        typeof(TenantAmbient).GetProperty(nameof(TenantAmbient.BypassFilter))!;
    private static readonly System.Reflection.PropertyInfo TenantIdProp =
        typeof(TenantAmbient).GetProperty(nameof(TenantAmbient.TenantId))!;

    /// <summary>
    /// Adds the shadow <c>TenantId</c> column and a tenant global query filter to
    /// the given CLR entity types. Call from OnModelCreating AFTER base mapping.
    /// </summary>
    /// <summary>
    /// Convenience overload: isolate every mapped entity (with a primary key, not owned)
    /// whose CLR namespace starts with <paramref name="domainNamespacePrefix"/>.
    /// Call at the END of OnModelCreating (after all mappings).
    /// </summary>
    public static void ApplyTenantId(ModelBuilder modelBuilder, string domainNamespacePrefix, string column = Column)
        => ApplyTenantId(modelBuilder, domainNamespacePrefix, exclude: null, column);

    /// <summary>
    /// Namespace overload with an opt-out set: entity types in <paramref name="exclude"/> are left
    /// out of tenant isolation (no shadow TenantId, no tenant query filter) — use for GLOBAL reference
    /// data shared across all tenants (e.g. currency masters, market exchange rates).
    /// </summary>
    public static void ApplyTenantId(ModelBuilder modelBuilder, string domainNamespacePrefix, IEnumerable<Type>? exclude, string column = Column)
    {
        var excluded = exclude is null ? null : new HashSet<Type>(exclude);
        var types = modelBuilder.Model.GetEntityTypes()
            .Where(t => !t.IsOwned() && t.FindPrimaryKey() != null
                     && t.ClrType.Namespace?.StartsWith(domainNamespacePrefix) == true
                     && (excluded is null || !excluded.Contains(t.ClrType)))
            .Select(t => t.ClrType).Distinct().ToList();
        ApplyTenantId(modelBuilder, types, column);
    }

    public static void ApplyTenantId(ModelBuilder modelBuilder, IEnumerable<Type> entityTypes, string column = Column)
    {
        foreach (var clr in entityTypes)
        {
            var entity = modelBuilder.Entity(clr);
            entity.Property<Guid?>(column);
            entity.HasIndex(column);

            // e => TenantAmbient.BypassFilter
            //      || (TenantAmbient.TenantId != null && EF.Property<Guid?>(e, column) == TenantAmbient.TenantId)
            //
            // The `ambient != null` guard is critical: a resolved-but-tenant-less non-super user
            // (ambient TenantId == null) must match NOTHING. Without it, `row.TenantId == null` would
            // let such a context see every legacy/demo row that was inserted with TenantId = NULL —
            // a cross-tenant leak. NULL-tenant rows are now visible ONLY to super-admins (via bypass).
            var e = Expression.Parameter(clr, "e");

            var bypass   = Expression.Property(null, BypassProp);
            var ambient  = Expression.Property(null, TenantIdProp);
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
