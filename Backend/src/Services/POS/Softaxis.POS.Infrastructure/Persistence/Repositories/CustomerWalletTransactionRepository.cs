using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class CustomerWalletTransactionRepository(POSDbContext db) : ICustomerWalletTransactionRepository
{
    public void Add(CustomerWalletTransaction transaction) => db.CustomerWalletTransactions.Add(transaction);

    /// <summary>Capped so a hand-edited pageSize cannot ask for a whole loyalty history.</summary>
    private const int MaxPageSize = 200;

    public async Task<(IReadOnlyList<CustomerWalletTransaction> Items, int Total)> GetByCustomerPagedAsync(
        Guid customerId, int page, int pageSize, CancellationToken ct = default)
    {
        page     = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var q = db.CustomerWalletTransactions.AsNoTracking()
            .Where(x => x.CustomerId == customerId);

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)      // stable: a top-up and its spend can share a timestamp
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }
}
