using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IStockTransferRepository
{
    Task<IReadOnlyList<StockTransfer>> GetSummaryDataAsync(CancellationToken ct = default);

    Task<IReadOnlyList<StockTransfer>> GetAllAsync(CancellationToken ct = default);

    Task<StockTransfer?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Tracked, with items — for status-transition commands.</summary>
    Task<StockTransfer?> GetTrackedByIdAsync(Guid id, CancellationToken ct = default);

    void Add(StockTransfer transfer);
}
