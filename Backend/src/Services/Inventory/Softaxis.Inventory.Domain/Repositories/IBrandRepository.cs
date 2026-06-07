using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IBrandRepository
{
    Task<IReadOnlyList<Brand>> GetAllAsync(string? search, bool? isActive, CancellationToken ct = default);
    Task<Brand?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> HasProductsAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct = default);
    void Add(Brand brand);
}
