using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Services;

internal sealed class BranchAccessGuard(RestaurantDbContext db, ICurrentUser currentUser) : IBranchAccessGuard
{
    private HashSet<Guid>? _accessible;
    private bool _loaded;
    private bool? _tenantHasBranches;

    public async Task<HashSet<Guid>?> GetAccessibleBranchIdsAsync(CancellationToken ct)
    {
        if (_loaded) return _accessible;
        _loaded = true;
        if (currentUser.IsSuperAdmin || currentUser.Id is null) return _accessible = null;

        var assigned = await db.UserBranches.AsNoTracking()
            .Where(x => x.UserId == currentUser.Id.Value)
            .Select(x => x.BranchId)
            .ToListAsync(ct);

        return _accessible = assigned.Count == 0 ? null : assigned.ToHashSet();
    }

    public async Task<HashSet<Guid>?> ResolveReadScopeAsync(Guid? requestedBranchId, CancellationToken ct)
    {
        var accessible = await GetAccessibleBranchIdsAsync(ct);
        if (requestedBranchId is null) return accessible;
        if (accessible is not null && !accessible.Contains(requestedBranchId.Value)) return [];
        return [requestedBranchId.Value];
    }

    public async Task<bool> CanWriteToBranchAsync(Guid? branchId, CancellationToken ct)
    {
        var accessible = await GetAccessibleBranchIdsAsync(ct);
        if (branchId is null)
            return accessible is null && !await TenantHasBranchesAsync(ct);
        return accessible is null
            ? await BranchExistsAsync(branchId.Value, ct)
            : accessible.Contains(branchId.Value);
    }

    // Branches live in Identity's schema (same physical DB). Tenant compared by hand — raw SQL
    // bypasses the EF tenant filter.
    private async Task<bool> TenantHasBranchesAsync(CancellationToken ct)
    {
        if (_tenantHasBranches is bool b) return b;
        var tenant = TenantAmbient.TenantId ?? Guid.Empty;
        var n = await db.Database.SqlQuery<int>($"""
            SELECT COUNT(*) AS Value FROM [identity].[branches]
            WHERE IsDeleted = 0 AND TenantId = {tenant}
            """).FirstAsync(ct);
        return (_tenantHasBranches = n > 0).Value;
    }

    private async Task<bool> BranchExistsAsync(Guid id, CancellationToken ct)
    {
        var tenant = TenantAmbient.TenantId ?? Guid.Empty;
        var n = await db.Database.SqlQuery<int>($"""
            SELECT COUNT(*) AS Value FROM [identity].[branches]
            WHERE Id = {id} AND IsDeleted = 0 AND TenantId = {tenant}
            """).FirstAsync(ct);
        return n > 0;
    }
}
