using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IPermissionRepository
{
    Task<IReadOnlyList<Permission>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<Permission>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);
    Task<IReadOnlyList<Permission>> GetByModuleAsync(string moduleId, CancellationToken ct = default);
    Task<IReadOnlyList<string>>     GetPermissionKeysForUserAsync(Guid userId, CancellationToken ct = default);
}
