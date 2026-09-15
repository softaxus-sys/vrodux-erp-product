using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.POS.Domain.Entities;

/// <summary>
/// Audit row for one "Sync to Cloud" upload from an offline till. Idempotency does NOT rely on
/// this table — every synced record carries its own ClientRef — so a retried batch simply
/// updates the same row with the latest tallies.
/// </summary>
public sealed class OfflineSyncBatch : AuditableEntity<Guid>
{
    public string   RegisterId    { get; private set; } = default!;
    public Guid     SyncedBy      { get; private set; }
    public int      SessionCount  { get; private set; }
    public int      AppliedCount  { get; private set; }
    public int      DuplicateCount { get; private set; }
    public int      RejectedCount { get; private set; }
    public DateTime LastSyncedAt  { get; private set; }

    private OfflineSyncBatch() { }

    public static OfflineSyncBatch Start(Guid batchId, string registerId, Guid syncedBy) => new()
    {
        Id         = batchId,
        RegisterId = registerId.Trim(),
        SyncedBy   = syncedBy,
    };

    public void Record(int sessions, int applied, int duplicates, int rejected)
    {
        SessionCount   = sessions;
        AppliedCount  += applied;
        DuplicateCount = duplicates;
        RejectedCount  = rejected;
        LastSyncedAt   = DateTime.UtcNow;
    }
}
