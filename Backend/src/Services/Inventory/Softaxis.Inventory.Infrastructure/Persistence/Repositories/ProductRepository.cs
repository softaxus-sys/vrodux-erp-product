using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
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

    // ── POS-catalogue rows ────────────────────────────────────────────────────
    //
    // Raw SQL, because these rows belong to another schema and have no EF entity here. That also
    // bypasses the global tenant filter, so every statement carries the same guard the rest of the
    // cross-schema code uses (Module 6b): super-admin/unresolved sees all, otherwise this tenant
    // only, and a NULL-tenant row is never matched.

    private static (int Bypass, Guid Tenant) TenantGuard() =>
        (TenantAmbient.BypassFilter ? 1 : 0, TenantAmbient.TenantId ?? Guid.Empty);

    public async Task<bool> UpdatePosProductAsync(PosProductUpdate u, CancellationToken ct = default)
    {
        var (bypass, tenant) = TenantGuard();

        // CategoryId is applied only when it resolves in [pos].[product_categories]. The edit form
        // offers INVENTORY categories, and pos.products.CategoryId has a foreign key to the POS
        // category table — so writing the chosen id blindly would fail the constraint and lose the
        // whole edit. Keeping the current category lets the rest of the edit succeed.
        var rows = await db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE p SET
                p.Name           = {u.Name},
                p.Description    = {u.Description},
                p.SKU            = {u.SKU},
                p.Barcode        = {u.Barcode},
                p.SalePrice      = {u.SalePrice},
                p.CostPrice      = {u.CostPrice},
                p.TaxRate        = {u.TaxRate},
                p.Unit           = {u.Unit},
                p.ReorderLevel   = {u.ReorderLevel},
                p.TrackInventory = {u.TrackInventory},
                p.ImageUrl       = {u.ImageUrl},
                p.CategoryId     = CASE
                                     WHEN EXISTS (SELECT 1 FROM [pos].[product_categories] c
                                                  WHERE c.Id = {u.CategoryId})
                                     THEN {u.CategoryId} ELSE p.CategoryId END,
                p.UpdatedAt      = SYSUTCDATETIME()
            FROM [pos].[products] p
            WHERE p.Id = {u.Id} AND p.IsDeleted = 0 AND ({bypass} = 1 OR p.TenantId = {tenant})", ct);

        return rows > 0;
    }

    public async Task<bool> SetPosProductActiveAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var (bypass, tenant) = TenantGuard();
        var rows = await db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE [pos].[products] SET IsActive = {isActive}, UpdatedAt = SYSUTCDATETIME()
               WHERE Id = {id} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})", ct);
        return rows > 0;
    }

    public async Task<bool> SoftDeletePosProductAsync(Guid id, CancellationToken ct = default)
    {
        var (bypass, tenant) = TenantGuard();
        // Soft delete, matching what Product.Delete() does for an inventory row — a POS product may
        // still be referenced by historical transactions, so the row must stay.
        var rows = await db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE [pos].[products] SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
               WHERE Id = {id} AND IsDeleted = 0 AND ({bypass} = 1 OR TenantId = {tenant})", ct);
        return rows > 0;
    }
}
