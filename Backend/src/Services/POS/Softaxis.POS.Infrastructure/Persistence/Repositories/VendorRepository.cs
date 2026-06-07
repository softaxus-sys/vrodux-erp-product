using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class VendorRepository(POSDbContext db) : IVendorRepository
{
    public async Task<PagedResult<Vendor>> GetPagedAsync(
        int page, int pageSize,
        string? search   = null,
        string? status   = null,
        string? category = null,
        CancellationToken ct = default)
    {
        var query = db.Vendors
            .Include(v => v.PurchaseOrders)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(v =>
                v.Name.Contains(search) ||
                (v.Code != null && v.Code.Contains(search)) ||
                (v.Email != null && v.Email.Contains(search)) ||
                (v.ContactPerson != null && v.ContactPerson.Contains(search)));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(v => v.Status == status);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(v => v.Category == category);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(v => v.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return PagedResult<Vendor>.Create(items, total, page, pageSize);
    }

    public Task<Vendor?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Vendors
          .Include(v => v.PurchaseOrders)
          .FirstOrDefaultAsync(v => v.Id == id, ct);

    public void Add(Vendor vendor) => db.Vendors.Add(vendor);
}
