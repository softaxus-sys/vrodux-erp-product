using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class StockMovementRepository(POSDbContext db) : IStockMovementRepository
{
    public async Task<PagedResult<StockMovement>> GetPagedAsync(
        int page, int pageSize,
        Guid? productId = null,
        StockAdjustmentType? type = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default)
    {
        var query = db.StockMovements
            .Include(m => m.Product)
            .AsNoTracking()
            .AsQueryable();

        if (productId.HasValue) query = query.Where(m => m.ProductId == productId.Value);
        if (type.HasValue)      query = query.Where(m => m.AdjustmentType == type.Value);
        if (from.HasValue)      query = query.Where(m => m.CreatedAt >= from.Value);
        if (to.HasValue)        query = query.Where(m => m.CreatedAt <= to.Value);

        query = query.OrderByDescending(m => m.CreatedAt);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<StockMovement>.Create(items, total, page, pageSize);
    }

    public void Add(StockMovement movement) => db.StockMovements.Add(movement);
}
