using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IPurchaseOrderRepository
{
    Task<PagedResult<PurchaseOrder>> GetPagedAsync(
        int page, int pageSize,
        string?   status   = null,
        Guid?     vendorId = null,
        string?   search   = null,
        DateTime? from     = null,
        DateTime? to       = null,
        CancellationToken ct = default);

    Task<PurchaseOrder?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool>           VendorExistsAsync(Guid vendorId, CancellationToken ct = default);

    void Add(PurchaseOrder po);
}
