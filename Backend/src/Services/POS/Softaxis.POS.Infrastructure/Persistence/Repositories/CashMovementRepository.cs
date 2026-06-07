using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class CashMovementRepository(POSDbContext db) : ICashMovementRepository
{
    public Task<List<CashMovement>> GetBySessionAsync(Guid sessionId, CancellationToken ct = default)
        => db.CashMovements.Where(m => m.SessionId == sessionId)
              .OrderByDescending(m => m.CreatedAt).ToListAsync(ct);

    public void Add(CashMovement movement) => db.CashMovements.Add(movement);
}
