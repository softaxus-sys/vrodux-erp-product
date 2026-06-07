using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IAuditLogRepository
{
    Task<PagedResult<AuditLog>> GetPagedAsync(
        int page, int pageSize,
        Guid? userId = null,
        string? action = null,
        DateTime? from = null, DateTime? to = null,
        CancellationToken ct = default);

    void Add(AuditLog log);
}

