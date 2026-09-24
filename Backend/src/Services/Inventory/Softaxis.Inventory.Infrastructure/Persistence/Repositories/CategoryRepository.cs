using Microsoft.EntityFrameworkCore;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
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

    /// <summary>
    /// A starter set of retail categories, seeded the first time a tenant opens the list.
    ///
    /// <para>
    /// A product cannot be saved without a category, so an unseeded workspace made "create a
    /// category" the unavoidable first step before anything could be added to the catalogue.
    /// Deliberately generic and few: these are a starting point a shop renames and prunes, not an
    /// opinion about what it sells.
    /// </para>
    /// </summary>
    public async Task<bool> EnsureDefaultsAsync(CancellationToken ct = default)
    {
        if (await db.ProductCategories.IgnoreQueryFilters()
                    .AnyAsync(c => EF.Property<Guid?>(c, "TenantId") == TenantAmbient.TenantId, ct))
            return false;

        (string Name, string Code, string? Description)[] defaults =
        [
            ("General",            "GEN",  "Uncategorised items"),
            ("Food & Beverages",   "FOOD", "Edible goods and drinks"),
            ("Household",          "HOME", "Cleaning and home supplies"),
            ("Personal Care",      "CARE", "Toiletries and cosmetics"),
            ("Stationery",         "STAT", "Paper, pens and office supplies"),
            ("Electronics",        "ELEC", "Devices and accessories"),
        ];

        foreach (var (name, code, description) in defaults)
            db.ProductCategories.Add(new ProductCategory(name, code, description, null));

        await db.SaveChangesAsync(ct);
        return true;
    }

    public void Add(ProductCategory category) => db.ProductCategories.Add(category);
}
