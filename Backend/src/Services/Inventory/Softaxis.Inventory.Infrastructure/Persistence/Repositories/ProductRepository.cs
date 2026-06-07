using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Infrastructure.Persistence.Repositories;

public sealed class ProductRepository(InventoryDbContext db) : IProductRepository
{
    public async Task<PagedResult<Product>> GetPagedAsync(
        int page, int pageSize,
        string? search, Guid? categoryId, bool? isActive, bool? isLowStock,
        CancellationToken ct = default)
    {
        IQueryable<Product> query = db.Products.AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Brand)
            .Include(x => x.UnitOfMeasure);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x =>
                x.Name.Contains(search) ||
                (x.SKU    != null && x.SKU.Contains(search)) ||
                (x.Barcode != null && x.Barcode.Contains(search)));

        if (categoryId.HasValue)
            query = query.Where(x => x.CategoryId == categoryId.Value);

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        if (isLowStock == true)
            query = query.Where(x => x.TrackInventory && x.StockQuantity <= x.ReorderLevel && x.ReorderLevel > 0);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(x => x.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return PagedResult<Product>.Create(items, total, page, pageSize);
    }

    public async Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.Products
            .Include(x => x.Category)
            .Include(x => x.Brand)
            .Include(x => x.UnitOfMeasure)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<bool> CategoryExistsAsync(Guid categoryId, CancellationToken ct = default) =>
        await db.ProductCategories.AnyAsync(x => x.Id == categoryId, ct);

    public void Add(Product product) => db.Products.Add(product);
}
