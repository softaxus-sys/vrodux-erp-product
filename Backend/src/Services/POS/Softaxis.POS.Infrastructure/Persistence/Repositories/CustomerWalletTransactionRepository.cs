using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class CustomerWalletTransactionRepository(POSDbContext db) : ICustomerWalletTransactionRepository
{
    public void Add(CustomerWalletTransaction transaction) => db.CustomerWalletTransactions.Add(transaction);

    public async Task<IReadOnlyList<CustomerWalletTransaction>> GetByCustomerAsync(Guid customerId, CancellationToken ct = default) =>
        await db.CustomerWalletTransactions.AsNoTracking()
            .Where(x => x.CustomerId == customerId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);
}
