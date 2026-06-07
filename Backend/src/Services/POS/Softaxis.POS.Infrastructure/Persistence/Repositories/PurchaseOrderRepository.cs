using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class PurchaseOrderRepository(POSDbContext db) : IPurchaseOrderRepository
{
    public async Task<PagedResult<PurchaseOrder>> GetPagedAsync(
        int page, int pageSize,
        string?   status   = null,
        Guid?     vendorId = null,
        string?   search   = null,
        DateTime? from     = null,
        DateTime? to       = null,
        CancellationToken ct = default)
    {
        var query = db.PurchaseOrders
            .Include(po => po.Vendor)
            .Include(po => po.Items)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(po => po.Status == status);

        if (vendorId.HasValue)
            query = query.Where(po => po.VendorId == vendorId.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(po =>
                po.OrderNumber.Contains(search) ||
                po.Vendor!.Name.Contains(search));

        if (from.HasValue) query = query.Where(po => po.CreatedAt >= from.Value);
        if (to.HasValue)   query = query.Where(po => po.CreatedAt <= to.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(po => po.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return PagedResult<PurchaseOrder>.Create(items, total, page, pageSize);
    }

    // No AsNoTracking — callers may mutate the entity
    public Task<PurchaseOrder?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.PurchaseOrders
          .Include(po => po.Vendor)
          .Include(po => po.Items)
          .FirstOrDefaultAsync(po => po.Id == id, ct);

    public Task<bool> VendorExistsAsync(Guid vendorId, CancellationToken ct = default) =>
        db.Vendors.AnyAsync(v => v.Id == vendorId, ct);

    public void Add(PurchaseOrder po) => db.PurchaseOrders.Add(po);
}
