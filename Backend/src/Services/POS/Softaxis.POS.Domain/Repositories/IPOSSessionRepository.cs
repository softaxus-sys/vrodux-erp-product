using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;

namespace Softaxis.POS.Domain.Repositories;

public interface IPOSSessionRepository
{
    Task<POSSession?>  GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<POSSession?>  GetActiveByRegisterAsync(string registerId, CancellationToken ct = default);
    Task<POSSession?>  GetActiveByUserAsync(Guid cashierId, CancellationToken ct = default);

    Task<PagedResult<POSSession>> GetPagedAsync(
        int page, int pageSize,
        Guid? cashierId = null,
        SessionStatus? status = null,
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default);

    void Add(POSSession session);
    void Update(POSSession session);
}
