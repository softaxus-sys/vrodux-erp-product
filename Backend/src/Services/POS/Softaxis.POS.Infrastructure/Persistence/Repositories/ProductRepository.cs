using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;
using Softaxis.POS.Domain.ValueObjects;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class ProductRepository(POSDbContext db) : IProductRepository
{
    private IQueryable<Product> BaseQuery =>
        db.Products.Include(p => p.Category);

    public Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(p => p.Id == id, ct);

    public Task<Product?> GetByBarcodeAsync(string barcode, CancellationToken ct = default)
    {
        // Pass a Barcode value object so EF Core applies the registered
        // converter (Barcode → string) to the parameter — no cast exception.
        var result = Barcode.Create(barcode);
        if (result.IsFailure) return Task.FromResult<Product?>(null);
        var vo = result.Value;
        return BaseQuery.FirstOrDefaultAsync(p => p.Barcode == vo, ct);
    }

    public Task<Product?> GetBySkuAsync(string sku, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(p => p.SKU == sku, ct);

    public Task<bool> BarcodeExistsAsync(string barcode, Guid? excludeId = null, CancellationToken ct = default)
    {
        // Same approach: Barcode value object → converter writes the string parameter.
        var result = Barcode.Create(barcode);
        if (result.IsFailure) return Task.FromResult(false);
        var vo = result.Value;

        return db.Products.AnyAsync(p =>
            p.Barcode == vo &&
            (excludeId == null || p.Id != excludeId), ct);
    }

    public Task<bool> SkuExistsAsync(string sku, Guid? excludeId = null, CancellationToken ct = default) =>
        db.Products.AnyAsync(p =>
            p.SKU == sku && (excludeId == null || p.Id != excludeId), ct);

    public async Task<PagedResult<Product>> GetPagedAsync(
        int page, int pageSize,
        string? search = null,
        Guid? categoryId = null,
        bool? isActive = null,
        bool? lowStock = null,
        string? sortBy = null, bool sortDesc = false,
        CancellationToken ct = default)
    {
        var query = db.Products
            .Include(p => p.Category)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";

            // EF Core cannot translate `p.Barcode.Value` (member access on a converted
            // value object) and will throw if a raw string is compared against a
            // Barcode-typed column (converter tries to cast string → Barcode).
            //
            // Solution: project barcode to a plain string in a sub-query; the anonymous
            // type's property has no converter attached, so EF.Functions.Like works.
            var barcodeMatchIds = db.Products
                .Select(p => new { p.Id, B = EF.Property<string?>(p, nameof(p.Barcode)) })
                .Where(x => x.B != null && EF.Functions.Like(x.B, pattern))
                .Select(x => x.Id);

            query = query.Where(p =>
                EF.Functions.Like(p.Name, pattern) ||
                (p.SKU != null && EF.Functions.Like(p.SKU, pattern)) ||
                barcodeMatchIds.Contains(p.Id));
        }

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value);

        if (isActive.HasValue)
            query = query.Where(p => p.IsActive == isActive.Value);

        if (lowStock == true)
            query = query.Where(p => p.TrackInventory && p.StockQuantity <= p.ReorderLevel && p.ReorderLevel > 0);

        query = (sortBy?.ToLower(), sortDesc) switch
        {
            ("name",       false) => query.OrderBy(p => p.Name),
            ("name",       true)  => query.OrderByDescending(p => p.Name),
            ("price",      false) => query.OrderBy(p => p.SalePrice),
            ("price",      true)  => query.OrderByDescending(p => p.SalePrice),
            ("stock",      false) => query.OrderBy(p => p.StockQuantity),
            ("stock",      true)  => query.OrderByDescending(p => p.StockQuantity),
            ("createdat",  false) => query.OrderBy(p => p.CreatedAt),
            ("createdat",  true)  => query.OrderByDescending(p => p.CreatedAt),
            _                     => query.OrderBy(p => p.Name)
        };

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<Product>.Create(items, total, page, pageSize);
    }

    public void Add(Product product)    => db.Products.Add(product);
    public void Update(Product product) => db.Products.Update(product);
    public void Remove(Product product) => db.Products.Remove(product);
}
