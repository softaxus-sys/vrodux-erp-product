using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IVendorRepository
{
    Task<PagedResult<Vendor>> GetPagedAsync(
        int page, int pageSize,
        string? search   = null,
        string? status   = null,
        string? category = null,
        CancellationToken ct = default);

    Task<Vendor?> GetByIdAsync(Guid id, CancellationToken ct = default);

    void Add(Vendor vendor);
}
