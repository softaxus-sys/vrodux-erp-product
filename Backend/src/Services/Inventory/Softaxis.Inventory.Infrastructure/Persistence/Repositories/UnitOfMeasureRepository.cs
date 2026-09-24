using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
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

    /// <summary>
    /// A starter set of units, seeded the first time a tenant opens the list.
    ///
    /// <para>
    /// Nothing seeded these before, so a new workspace began with an empty Units list - and since
    /// the stock-item form needs a unit, the first thing anyone had to do was invent "Piece"
    /// themselves. These are ordinary editable rows: rename them, deactivate them, delete the
    /// ones the shop does not use.
    /// </para>
    /// </summary>
    public async Task<bool> EnsureDefaultsAsync(CancellationToken ct = default)
    {
        if (await db.UnitsOfMeasure.IgnoreQueryFilters()
                    .AnyAsync(u => EF.Property<Guid?>(u, "TenantId") == TenantAmbient.TenantId, ct))
            return false;

        (string Name, string Symbol, string? Description)[] defaults =
        [
            ("Piece",      "pcs",   "Individual item"),
            ("Box",        "box",   "Box of items"),
            ("Carton",     "ctn",   "Carton / case"),
            ("Pack",       "pack",  "Multi-pack"),
            ("Dozen",      "dzn",   "Twelve items"),
            ("Kilogram",   "kg",    "Weight in kilograms"),
            ("Gram",       "g",     "Weight in grams"),
            ("Litre",      "L",     "Volume in litres"),
            ("Millilitre", "ml",    "Volume in millilitres"),
            ("Metre",      "m",     "Length in metres"),
        ];

        foreach (var (name, symbol, description) in defaults)
            db.UnitsOfMeasure.Add(new UnitOfMeasure(name, symbol, description));

        await db.SaveChangesAsync(ct);
        return true;
    }

    public void Add(UnitOfMeasure uom) => db.UnitsOfMeasure.Add(uom);
}
