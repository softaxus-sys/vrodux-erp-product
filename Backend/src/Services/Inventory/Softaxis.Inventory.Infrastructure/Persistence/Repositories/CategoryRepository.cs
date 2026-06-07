using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class CategoryRepository(InventoryDbContext db) : ICategoryRepository
{
    public async Task<IReadOnlyList<ProductCategory>> GetAllAsync(
        string? search, bool? isActive, CancellationToken ct = default)
    {
        var query = db.ProductCategories.Include(x => x.Products).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x =>
                x.Name.Contains(search) ||
                (x.Code != null && x.Code.Contains(search)));

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        return await query.OrderBy(x => x.Name).ToListAsync(ct);
    }

    public async Task<ProductCategory?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.ProductCategories
            .Include(x => x.Products)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<bool> HasProductsAsync(Guid id, CancellationToken ct = default) =>
        await db.Products.AnyAsync(p => p.CategoryId == id, ct);

    public void Add(ProductCategory category) => db.ProductCategories.Add(category);
}
