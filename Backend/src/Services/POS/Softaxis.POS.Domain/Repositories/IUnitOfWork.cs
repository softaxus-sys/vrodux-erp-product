namespace Softaxis.POS.Domain.Repositories;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);

    /// <summary>
    /// Drop every pending tracked change. Used when one step of a multi-step operation fails after
    /// mutating entities (e.g. a loyalty redemption), so the NEXT save cannot persist half of it.
    /// </summary>
    void DiscardChanges();
}
