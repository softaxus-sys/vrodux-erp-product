using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class BrandRepository(InventoryDbContext db) : IBrandRepository
{
    public async Task<IReadOnlyList<Brand>> GetAllAsync(
        string? search, bool? isActive, CancellationToken ct = default)
    {
        var query = db.Brands.Include(x => x.Products).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x =>
                x.Name.Contains(search) ||
                (x.Code != null && x.Code.Contains(search)));

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        return await query.OrderBy(x => x.Name).ToListAsync(ct);
    }

    public async Task<Brand?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.Brands
            .Include(x => x.Products)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<bool> HasProductsAsync(Guid id, CancellationToken ct = default) =>
        await db.Products.AnyAsync(p => p.BrandId == id, ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct = default) =>
        await db.Brands.AnyAsync(b =>
            b.Name == name &&
            (excludeId == null || b.Id != excludeId.Value), ct);

    public void Add(Brand brand) => db.Brands.Add(brand);
}
