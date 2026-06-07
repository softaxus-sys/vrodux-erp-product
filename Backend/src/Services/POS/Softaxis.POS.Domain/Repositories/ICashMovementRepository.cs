using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ICashMovementRepository
{
    Task<List<CashMovement>> GetBySessionAsync(Guid sessionId, CancellationToken ct = default);
    void Add(CashMovement movement);
}
