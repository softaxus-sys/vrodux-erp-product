using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IHeldTransactionRepository
{
    Task<HeldTransaction?>              GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<HeldTransaction>> GetActiveBySessionAsync(Guid sessionId, CancellationToken ct = default);

    void Add(HeldTransaction held);
    void Update(HeldTransaction held);
}
