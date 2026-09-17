using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class PosSettingsRepository(POSDbContext db) : IPosSettingsRepository
{
    // The tenant global filter scopes these to the caller's tenant.
    // IsDeleted is filtered by hand — TenantIsolation replaces any entity-level soft-delete filter.
    public Task<PosSettings?> GetAsync(CancellationToken ct = default) =>
        db.PosSettings.Where(s => !s.IsDeleted).OrderBy(s => s.CreatedAt).FirstOrDefaultAsync(ct);

    public void Add(PosSettings settings) => db.PosSettings.Add(settings);

    public Task<OfflineSyncBatch?> GetBatchAsync(Guid batchId, CancellationToken ct = default) =>
        db.OfflineSyncBatches.FirstOrDefaultAsync(b => b.Id == batchId, ct);

    public void AddBatch(OfflineSyncBatch batch) => db.OfflineSyncBatches.Add(batch);

    public Task<PosTillStatus?> GetTillAsync(string deviceId, CancellationToken ct = default) =>
        db.PosTillStatuses.FirstOrDefaultAsync(t => t.DeviceId == deviceId && !t.IsDeleted, ct);

    public Task<List<PosTillStatus>> GetTillsWithUnsyncedWorkAsync(CancellationToken ct = default) =>
        db.PosTillStatuses
            .Where(t => !t.IsDeleted && (t.PendingRecords > 0 || t.UnsyncedShifts > 0))
            .OrderBy(t => t.ReportedAt)
            .ToListAsync(ct);

    public void AddTill(PosTillStatus till) => db.PosTillStatuses.Add(till);

    public Task<List<POSSession>> GetOpenSessionsAsync(bool offline, CancellationToken ct = default) =>
        db.Sessions
            .Where(s => (s.Status == SessionStatus.Open || s.Status == SessionStatus.Suspended)
                     && (offline ? s.ClientRef != null : s.ClientRef == null))
            .OrderBy(s => s.OpenedAt)
            .ToListAsync(ct);
}
