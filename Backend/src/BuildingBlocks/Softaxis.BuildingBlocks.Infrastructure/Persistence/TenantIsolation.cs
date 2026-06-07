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
    {
        var types = modelBuilder.Model.GetEntityTypes()
            .Where(t => !t.IsOwned() && t.FindPrimaryKey() != null
                     && t.ClrType.Namespace?.StartsWith(domainNamespacePrefix) == true)
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
            //      || EF.Property<Guid?>(e, column) == TenantAmbient.TenantId
            var e = Expression.Parameter(clr, "e");

            var bypass   = Expression.Property(null, BypassProp);
            var ambient  = Expression.Property(null, TenantIdProp);
            var rowValue = Expression.Call(
                typeof(EF), nameof(EF.Property), [typeof(Guid?)],
                e, Expression.Constant(column));

            var body = Expression.OrElse(bypass, Expression.Equal(rowValue, ambient));
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
