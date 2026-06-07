using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IWarehouseRepository
{
    Task<IReadOnlyList<Warehouse>> GetAllAsync(CancellationToken ct = default);
    Task<Warehouse?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> AnyAsync(CancellationToken ct = default);

    void Add(Warehouse warehouse);
}
