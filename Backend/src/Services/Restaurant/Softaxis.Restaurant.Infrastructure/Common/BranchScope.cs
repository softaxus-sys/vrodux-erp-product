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

    public static IQueryable<WaitlistEntry> Apply(IQueryable<WaitlistEntry> q, HashSet<Guid>? accessible) =>
        accessible is null ? q : q.Where(x => x.BranchId == null || accessible.Contains(x.BranchId.Value));
}
