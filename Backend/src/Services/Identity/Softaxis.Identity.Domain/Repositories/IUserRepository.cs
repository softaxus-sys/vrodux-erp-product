using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByUsernameAsync(string username, CancellationToken ct = default);
    Task<bool>  EmailExistsAsync(string email, CancellationToken ct = default);
    Task<bool>  UsernameExistsAsync(string username, CancellationToken ct = default);

    Task<PagedResult<User>> GetPagedAsync(
        int page, int pageSize,
        string? search = null,
        string? sortBy = null, bool sortDesc = false,
        Guid? tenantId = null,
        CancellationToken ct = default);

    Task<int> CountByTenantAsync(Guid tenantId, CancellationToken ct = default);

    void Add(User user);
    void Update(User user);
    void Remove(User user);
}

