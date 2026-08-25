using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IBranchRepository
{
    // Every method is tenant-scoped: pass the caller's tenant, or null for a super-admin
    // (which sees only global/legacy rows, never another tenant's branches).
    Task<PagedResult<Branch>> GetPagedAsync(int page, int pageSize, string? status, Guid? tenantScope, CancellationToken ct = default);
    Task<Branch?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> CodeExistsAsync(string code, Guid? tenantScope, CancellationToken ct = default);
    Task<bool> CodeExistsExcludingAsync(string code, Guid excludeId, Guid? tenantScope, CancellationToken ct = default);

    void Add(Branch branch);
}
