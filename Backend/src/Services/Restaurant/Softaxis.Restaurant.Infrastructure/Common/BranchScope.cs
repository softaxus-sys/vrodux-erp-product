using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Applies IBranchAccessGuard's accessible-branch set to a queryable — a null set means unrestricted
/// (no-op); a non-null set filters to rows whose BranchId is in the set OR unbranched (BranchId null,
/// e.g. a takeaway order or a single-location tenant's table). One small overload per entity rather
/// than a generic constraint, since none of these entities share a common "IHasBranch" interface.
/// </summary>
internal static class BranchScope
{
    public static IQueryable<Table> Apply(IQueryable<Table> q, HashSet<Guid>? accessible) =>
        accessible is null ? q : q.Where(x => x.BranchId == null || accessible.Contains(x.BranchId.Value));

    public static IQueryable<Order> Apply(IQueryable<Order> q, HashSet<Guid>? accessible) =>
        accessible is null ? q : q.Where(x => x.BranchId == null || accessible.Contains(x.BranchId.Value));

    public static IQueryable<Reservation> Apply(IQueryable<Reservation> q, HashSet<Guid>? accessible) =>
        accessible is null ? q : q.Where(x => x.BranchId == null || accessible.Contains(x.BranchId.Value));

    public static IQueryable<Floor> Apply(IQueryable<Floor> q, HashSet<Guid>? accessible) =>
        accessible is null ? q : q.Where(x => x.BranchId == null || accessible.Contains(x.BranchId.Value));

    public static IQueryable<Driver> Apply(IQueryable<Driver> q, HashSet<Guid>? accessible) =>
        accessible is null ? q : q.Where(x => x.BranchId == null || accessible.Contains(x.BranchId.Value));

    /// <summary>A delivery run has no branch of its own; it belongs to its order's branch.</summary>
    public static IQueryable<DeliveryOrder> ApplyByOrder(IQueryable<DeliveryOrder> q, Persistence.RestaurantDbContext db, HashSet<Guid>? accessible)
    {
        if (accessible is null) return q;
        var orderIds = Apply(db.Orders.AsNoTracking(), accessible).Select(o => o.Id);
        return q.Where(d => orderIds.Contains(d.OrderId));
    }

    public static IQueryable<WaitlistEntry> Apply(IQueryable<WaitlistEntry> q, HashSet<Guid>? accessible) =>
        accessible is null ? q : q.Where(x => x.BranchId == null || accessible.Contains(x.BranchId.Value));
}
