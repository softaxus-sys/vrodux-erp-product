using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Keeps the "one writer" rule true on the cloud: a branch that runs on its own server
/// (<c>identity.branches.ServerMode = 'local'</c>) is the only place its live data is written. The
/// cloud holds a synced copy and refuses direct operational writes for that branch, from any user or
/// any API - otherwise a bill fixed at head office and the same bill changing at the till would be a
/// conflict that nothing could resolve.
///
/// <para>
/// Only active when this server is the cloud (<c>BranchSync:Mode = Cloud</c>). On a branch server
/// and on every ordinary deployment it never does anything. The sync endpoint writes with raw SQL and
/// does not pass through here, so it is not blocked.
/// </para>
///
/// <para>See <c>docs/branch-server-design.md</c> §7.</para>
/// </summary>
internal sealed class LocalBranchGuard(RestaurantDbContext db, IConfiguration configuration)
{
    private bool OnCloud =>
        string.Equals(configuration["BranchSync:Mode"], "Cloud", StringComparison.OrdinalIgnoreCase);

    private readonly Dictionary<Guid, bool> _cache = [];

    public async Task<bool> IsLocalAsync(Guid? branchId, CancellationToken ct)
    {
        if (!OnCloud || branchId is null) return false;
        if (_cache.TryGetValue(branchId.Value, out var known)) return known;

        bool local;
        try
        {
            var mode = await db.Database
                .SqlQuery<string?>($"SELECT [ServerMode] AS [Value] FROM [identity].[branches] WHERE [Id] = {branchId.Value}")
                .ToListAsync(ct);
            local = string.Equals(mode.FirstOrDefault(), "local", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            // Column not there yet (older schema) - treat the branch as cloud-run, which is what it was.
            local = false;
        }
        return _cache[branchId.Value] = local;
    }

    public static Error Refusal() => Error.Custom("Branch.Conflict",
        "This branch runs on its own server. Its orders are taken and changed there - " +
        "head office can see them, but not edit them.");
}
