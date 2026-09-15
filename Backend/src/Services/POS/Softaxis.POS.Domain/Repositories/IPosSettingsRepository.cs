using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IPosSettingsRepository
{
    /// <summary>The tenant's settings row, or null when the tenant has never saved one.</summary>
    Task<PosSettings?> GetAsync(CancellationToken ct = default);
    void Add(PosSettings settings);

    Task<OfflineSyncBatch?> GetBatchAsync(Guid batchId, CancellationToken ct = default);
    void AddBatch(OfflineSyncBatch batch);

    Task<PosTillStatus?> GetTillAsync(string deviceId, CancellationToken ct = default);
    Task<List<PosTillStatus>> GetTillsWithUnsyncedWorkAsync(CancellationToken ct = default);
    void AddTill(PosTillStatus till);

    /// <summary>Shifts still open or suspended. <paramref name="offline"/> true = uploaded from offline tills.</summary>
    Task<List<POSSession>> GetOpenSessionsAsync(bool offline, CancellationToken ct = default);
}
