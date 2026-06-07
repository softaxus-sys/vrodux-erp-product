using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class UnitOfMeasureRepository(InventoryDbContext db) : IUnitOfMeasureRepository
{
    public async Task<IReadOnlyList<UnitOfMeasure>> GetAllAsync(
        string? search, bool? isActive, CancellationToken ct = default)
    {
        var query = db.UnitsOfMeasure.Include(x => x.Products).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x =>
                x.Name.Contains(search) ||
                x.Symbol.Contains(search));

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        return await query.OrderBy(x => x.Name).ToListAsync(ct);
    }

    public async Task<UnitOfMeasure?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.UnitsOfMeasure
            .Include(x => x.Products)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<bool> HasProductsAsync(Guid id, CancellationToken ct = default) =>
        await db.Products.AnyAsync(p => p.UnitOfMeasureId == id, ct);

    public async Task<bool> ExistsBySymbolAsync(string symbol, Guid? excludeId, CancellationToken ct = default) =>
        await db.UnitsOfMeasure.AnyAsync(u =>
            u.Symbol == symbol &&
            (excludeId == null || u.Id != excludeId.Value), ct);

    public void Add(UnitOfMeasure uom) => db.UnitsOfMeasure.Add(uom);
}
