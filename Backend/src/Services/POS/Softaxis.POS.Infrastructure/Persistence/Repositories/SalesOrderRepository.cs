using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class SalesOrderRepository(POSDbContext db) : ISalesOrderRepository
{
    public async Task<PagedResult<SalesOrder>> GetPagedAsync(
        int page, int pageSize,
        string?   status     = null,
        Guid?     customerId = null,
        string?   search     = null,
        DateTime? from       = null,
        DateTime? to         = null,
        CancellationToken ct = default)
    {
        var query = db.SalesOrders
            .Include(so => so.Items)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(so => so.Status == status);

        if (customerId.HasValue)
            query = query.Where(so => so.CustomerId == customerId.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(so =>
                so.OrderNumber.Contains(search) ||
                (so.CustomerName != null && so.CustomerName.Contains(search)));

        if (from.HasValue) query = query.Where(so => so.CreatedAt >= from.Value);
        if (to.HasValue)   query = query.Where(so => so.CreatedAt <= to.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(so => so.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return PagedResult<SalesOrder>.Create(items, total, page, pageSize);
    }

    public Task<SalesOrder?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.SalesOrders
          .Include(so => so.Items)
          .FirstOrDefaultAsync(so => so.Id == id, ct);

    public void Add(SalesOrder so) => db.SalesOrders.Add(so);
}
