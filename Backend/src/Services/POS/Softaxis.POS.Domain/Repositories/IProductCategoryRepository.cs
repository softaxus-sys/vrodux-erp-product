using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IProductCategoryRepository
{
    Task<ProductCategory?>              GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// POS category by id; if POS has none, copies the matching Master Data (Inventory) category
    /// into POS with the same id (added to the unit of work, saved by the caller). Null if neither exists.
    /// </summary>
    Task<ProductCategory?>              GetOrMirrorFromInventoryAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<ProductCategory>> GetAllAsync(bool activeOnly = true, CancellationToken ct = default);
    Task<bool>                          NameExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default);
    Task<PagedResult<ProductCategory>>  GetPagedAsync(int page, int pageSize, string? search = null, CancellationToken ct = default);

    void Add(ProductCategory category);
    void Update(ProductCategory category);
    void Remove(ProductCategory category);
}
