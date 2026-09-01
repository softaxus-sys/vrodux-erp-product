using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class StockTransferRepository(InventoryDbContext db) : IStockTransferRepository
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the entire movement history.</summary>
    private const int MaxPageSize = 200;

    public async Task<(IReadOnlyList<StockTransfer> Items, int Total)> GetPagedAsync(
        string? status, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        page     = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var q = db.StockTransfers.AsNoTracking().Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(x => x.Status == status);

        // What a storeman actually looks a transfer up by.
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(x => x.TransferNumber.Contains(search)
                          || x.FromWarehouseName.Contains(search)
                          || x.ToWarehouseName.Contains(search)
                          || x.RequestedBy.Contains(search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        // Include AFTER the filter and the page, so only the thirty rows on screen drag their items
        // along — including first would join every line item in the table.
        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)          // stable: a bulk import lands many rows on one timestamp
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(x => x.Items)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<(int Total, int Draft, int Pending, int InTransit, int Received, int Cancelled, decimal TotalValue)>
        GetSummaryAsync(CancellationToken ct = default)
    {
        // One grouped query. The counts used to be taken over every transfer pulled into memory, which
        // grew with the warehouse rather than staying flat.
        var r = await db.StockTransfers.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total      = g.Count(),
                Draft      = g.Count(x => x.Status == "draft"),
                Pending    = g.Count(x => x.Status == "pending"),
                InTransit  = g.Count(x => x.Status == "in_transit"),
                Received   = g.Count(x => x.Status == "received"),
                Cancelled  = g.Count(x => x.Status == "cancelled"),
                TotalValue = g.Sum(x => x.TotalValue),
            })
            .FirstOrDefaultAsync(ct);

        // GroupBy over an empty set yields no row at all, not a row of zeros.
        return r is null ? (0, 0, 0, 0, 0, 0, 0m)
                        : (r.Total, r.Draft, r.Pending, r.InTransit, r.Received, r.Cancelled, r.TotalValue);
    }

    public async Task<StockTransfer?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.StockTransfers.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<StockTransfer?> GetTrackedByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.StockTransfers.Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public void Add(StockTransfer transfer) => db.StockTransfers.Add(transfer);
}
