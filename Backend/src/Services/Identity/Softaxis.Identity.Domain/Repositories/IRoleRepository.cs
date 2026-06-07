using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IRoleRepository
{
    Task<Role?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Role?> GetByNameAsync(string name, CancellationToken ct = default);
    Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken ct = default);
    Task<PagedResult<Role>>  GetPagedAsync(int page, int pageSize, string? search = null, CancellationToken ct = default);
    Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default);

    void Add(Role role);
    void Update(Role role);
    void Remove(Role role);
}

