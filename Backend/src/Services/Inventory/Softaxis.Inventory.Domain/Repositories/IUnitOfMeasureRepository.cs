using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IUnitOfMeasureRepository
{
    Task<IReadOnlyList<UnitOfMeasure>> GetAllAsync(string? search, bool? isActive, CancellationToken ct = default);
    Task<UnitOfMeasure?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> HasProductsAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsBySymbolAsync(string symbol, Guid? excludeId, CancellationToken ct = default);
    void Add(UnitOfMeasure uom);
}
