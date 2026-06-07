using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IBranchRepository
{
    Task<PagedResult<Branch>> GetPagedAsync(int page, int pageSize, string? status, CancellationToken ct = default);
    Task<Branch?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);
    Task<bool> CodeExistsExcludingAsync(string code, Guid excludeId, CancellationToken ct = default);

    void Add(Branch branch);
}
