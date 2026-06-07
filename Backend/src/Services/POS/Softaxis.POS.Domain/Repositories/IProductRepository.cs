using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IProductRepository
{
    Task<Product?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Product?> GetByBarcodeAsync(string barcode, CancellationToken ct = default);
    Task<Product?> GetBySkuAsync(string sku, CancellationToken ct = default);
    Task<bool>     BarcodeExistsAsync(string barcode, Guid? excludeId = null, CancellationToken ct = default);
    Task<bool>     SkuExistsAsync(string sku, Guid? excludeId = null, CancellationToken ct = default);

    Task<PagedResult<Product>> GetPagedAsync(
        int page, int pageSize,
        string? search = null,
        Guid? categoryId = null,
        bool? isActive = null,
        bool? lowStock = null,
        string? sortBy = null, bool sortDesc = false,
        CancellationToken ct = default);

    void Add(Product product);
    void Update(Product product);
    void Remove(Product product);
}
