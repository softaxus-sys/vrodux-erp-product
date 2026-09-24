using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface ICategoryRepository
{
    Task<IReadOnlyList<ProductCategory>> GetAllAsync(string? search, bool? isActive, CancellationToken ct = default);
    Task<ProductCategory?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> HasProductsAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Gives a tenant a starter set of product categories the first time it looks.
    /// Returns true if it seeded.
    /// </summary>
    Task<bool> EnsureDefaultsAsync(CancellationToken ct = default);

    void Add(ProductCategory category);
}
