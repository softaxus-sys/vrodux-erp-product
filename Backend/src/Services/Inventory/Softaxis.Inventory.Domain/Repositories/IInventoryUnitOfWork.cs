namespace Softaxis.Inventory.Domain.Repositories;

public interface IInventoryUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
