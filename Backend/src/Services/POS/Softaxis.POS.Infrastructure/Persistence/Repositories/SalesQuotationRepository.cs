using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class SalesQuotationRepository(POSDbContext db) : ISalesQuotationRepository
{
    public async Task<PagedResult<SalesQuotation>> GetPagedAsync(
        int page, int pageSize,
        string?   status     = null,
        Guid?     customerId = null,
        string?   search     = null,
        DateTime? from       = null,
        DateTime? to         = null,
        CancellationToken ct = default)
    {
        var query = db.SalesQuotations
            .Include(sq => sq.Items)
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(sq => sq.Status == status);

        if (customerId.HasValue)
            query = query.Where(sq => sq.CustomerId == customerId.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(sq =>
                sq.QuotationNumber.Contains(search) ||
                (sq.CustomerName != null && sq.CustomerName.Contains(search)));

        if (from.HasValue) query = query.Where(sq => sq.CreatedAt >= from.Value);
        if (to.HasValue)   query = query.Where(sq => sq.CreatedAt <= to.Value);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(sq => sq.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return PagedResult<SalesQuotation>.Create(items, total, page, pageSize);
    }

    public Task<SalesQuotation?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.SalesQuotations
          .Include(sq => sq.Items)
          .FirstOrDefaultAsync(sq => sq.Id == id, ct);

    public void Add(SalesQuotation sq) => db.SalesQuotations.Add(sq);
}
