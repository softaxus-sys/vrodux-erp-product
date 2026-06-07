using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class WarehouseRepository(InventoryDbContext db) : IWarehouseRepository
{
    public async Task<IReadOnlyList<Warehouse>> GetAllAsync(CancellationToken ct = default) =>
        await db.Warehouses
            .Include(x => x.StockMovements)
            .AsNoTracking()
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Name)
            .ToListAsync(ct);

    public async Task<Warehouse?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.Warehouses
            .Include(x => x.StockMovements)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<bool> AnyAsync(CancellationToken ct = default) =>
        await db.Warehouses.AnyAsync(ct);

    public void Add(Warehouse warehouse) => db.Warehouses.Add(warehouse);
}
