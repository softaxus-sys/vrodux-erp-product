using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class ProductCategoryRepository(POSDbContext db) : IProductCategoryRepository
{
    public Task<ProductCategory?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.ProductCategories
            .Include(c => c.ParentCategory)
            .Include(c => c.Products)
            .Include(c => c.SubCategories)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<IReadOnlyList<ProductCategory>> GetAllAsync(bool activeOnly = true, CancellationToken ct = default)
    {
        var query = db.ProductCategories
            .Include(c => c.ParentCategory)
            .AsQueryable();

        if (activeOnly)
            query = query.Where(c => c.IsActive);

        return await query.OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
    }

    public Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default) =>
        db.ProductCategories.AnyAsync(c =>
            EF.Functions.Like(c.Name, name) &&
            (excludeId == null || c.Id != excludeId), ct);

    public async Task<PagedResult<ProductCategory>> GetPagedAsync(
        int page, int pageSize, string? search = null, CancellationToken ct = default)
    {
        var query = db.ProductCategories
            .Include(c => c.ParentCategory)
            .Include(c => c.Products)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(c => EF.Functions.Like(c.Name, pattern));
        }

        query = query.OrderBy(c => c.SortOrder).ThenBy(c => c.Name);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<ProductCategory>.Create(items, total, page, pageSize);
    }

    public void Add(ProductCategory category)    => db.ProductCategories.Add(category);
    public void Update(ProductCategory category) => db.ProductCategories.Update(category);
    public void Remove(ProductCategory category) => db.ProductCategories.Remove(category);
}
