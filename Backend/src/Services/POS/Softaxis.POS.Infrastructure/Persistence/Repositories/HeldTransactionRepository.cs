using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class HeldTransactionRepository(POSDbContext db) : IHeldTransactionRepository
{
    public Task<HeldTransaction?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.HeldTransactions.FirstOrDefaultAsync(h => h.Id == id, ct);

    public async Task<IReadOnlyList<HeldTransaction>> GetActiveBySessionAsync(Guid sessionId, CancellationToken ct = default) =>
        await db.HeldTransactions
            .Where(h => h.SessionId == sessionId && !h.IsRecalled)
            .OrderByDescending(h => h.HeldAt)
            .ToListAsync(ct);

    public void Add(HeldTransaction held)    => db.HeldTransactions.Add(held);
    public void Update(HeldTransaction held) => db.HeldTransactions.Update(held);
}
