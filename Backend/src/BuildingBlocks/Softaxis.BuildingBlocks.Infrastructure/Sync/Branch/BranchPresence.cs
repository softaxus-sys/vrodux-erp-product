using System.Collections.Concurrent;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>
/// On the cloud: when each branch server last pulled. A branch pulls every few seconds, so a branch not
/// heard from for a while is treated as offline, and orders that only reach the cloud (QR, Foodpanda)
/// are refused for it rather than queued for a till that may not see them for hours.
///
/// <para>
/// Kept in memory. After a cloud restart every branch counts as offline until its next pull - seconds
/// later - which errs on the side of refusing. Assumes one cloud process; a scaled-out cloud would need
/// this in the database.
/// </para>
/// </summary>
public static class BranchPresence
{
    private static readonly ConcurrentDictionary<Guid, DateTime> LastSeen = new();

    public static void Seen(Guid branchId) => LastSeen[branchId] = DateTime.UtcNow;

    public static DateTime? LastSeenAt(Guid branchId) => LastSeen.TryGetValue(branchId, out var t) ? t : null;

    public static bool IsOnline(Guid branchId, TimeSpan within) =>
        LastSeen.TryGetValue(branchId, out var t) && DateTime.UtcNow - t <= within;
}
