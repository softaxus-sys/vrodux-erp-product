using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface ICategoryRepository
{
    Task<IReadOnlyList<ProductCategory>> GetAllAsync(string? search, bool? isActive, CancellationToken ct = default);
    Task<ProductCategory?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> HasProductsAsync(Guid id, CancellationToken ct = default);

    void Add(ProductCategory category);
}
