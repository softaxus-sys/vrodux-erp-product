using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ISalesOrderRepository
{
    Task<PagedResult<SalesOrder>> GetPagedAsync(
        int page, int pageSize,
        string?   status     = null,
        Guid?     customerId = null,
        string?   search     = null,
        DateTime? from       = null,
        DateTime? to         = null,
        CancellationToken ct = default);

    Task<SalesOrder?> GetByIdAsync(Guid id, CancellationToken ct = default);

    void Add(SalesOrder so);
}
