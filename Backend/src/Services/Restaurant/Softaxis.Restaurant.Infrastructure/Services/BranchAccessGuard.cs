using Microsoft.EntityFrameworkCore;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Services;

internal sealed class BranchAccessGuard(RestaurantDbContext db, ICurrentUser currentUser) : IBranchAccessGuard
{
    public async Task<HashSet<Guid>?> GetAccessibleBranchIdsAsync(CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin || currentUser.Id is null) return null;

        var assigned = await db.UserBranches.AsNoTracking()
            .Where(x => x.UserId == currentUser.Id.Value)
            .Select(x => x.BranchId)
            .ToListAsync(ct);

        return assigned.Count == 0 ? null : assigned.ToHashSet();
    }
}
