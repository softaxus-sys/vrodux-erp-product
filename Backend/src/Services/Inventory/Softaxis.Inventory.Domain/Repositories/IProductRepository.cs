using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Domain.Entities;

namespace Softaxis.Inventory.Domain.Repositories;

public interface IProductRepository
{
    Task<PagedResult<Product>> GetPagedAsync(
        int page, int pageSize,
        string? search, Guid? categoryId, bool? isActive, bool? isLowStock,
        CancellationToken ct = default);

    Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool>     CategoryExistsAsync(Guid categoryId, CancellationToken ct = default);

    void Add(Product product);
}
