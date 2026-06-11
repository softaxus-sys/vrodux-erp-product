using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class StockTransferRepository(InventoryDbContext db) : IStockTransferRepository
{
    public async Task<IReadOnlyList<StockTransfer>> GetSummaryDataAsync(CancellationToken ct = default) =>
        await db.StockTransfers.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<StockTransfer>> GetAllAsync(CancellationToken ct = default) =>
        await db.StockTransfers.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

    public async Task<StockTransfer?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.StockTransfers.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<StockTransfer?> GetTrackedByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.StockTransfers.Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public void Add(StockTransfer transfer) => db.StockTransfers.Add(transfer);
}
