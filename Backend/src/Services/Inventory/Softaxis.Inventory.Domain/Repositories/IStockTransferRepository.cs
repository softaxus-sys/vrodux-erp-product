using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IStockTransferRepository
{
    /// <summary>One page of transfers, newest first, with their items. Returns the page and the total.</summary>
    Task<(IReadOnlyList<StockTransfer> Items, int Total)> GetPagedAsync(
        string? status, string? search, int page, int pageSize, CancellationToken ct = default);

    /// <summary>Status counts and total value, aggregated in SQL — never materialises the rows.</summary>
    Task<(int Total, int Draft, int Pending, int InTransit, int Received, int Cancelled, decimal TotalValue)>
        GetSummaryAsync(CancellationToken ct = default);

    Task<StockTransfer?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Tracked, with items — for status-transition commands.</summary>
    Task<StockTransfer?> GetTrackedByIdAsync(Guid id, CancellationToken ct = default);

    void Add(StockTransfer transfer);
}
