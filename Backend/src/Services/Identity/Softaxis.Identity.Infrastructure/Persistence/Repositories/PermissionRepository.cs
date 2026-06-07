using Softaxis.BuildingBlocks.Domain.Pagination;
using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class PermissionRepository(IdentityDbContext db) : IPermissionRepository
{
    public async Task<IReadOnlyList<Permission>> GetAllAsync(CancellationToken ct = default) =>
        await db.Permissions.OrderBy(p => p.ModuleId).ThenBy(p => p.Action).ToListAsync(ct);

    public async Task<IReadOnlyList<Permission>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default)
    {
        var idList = ids.ToList();
        return await db.Permissions.Where(p => idList.Contains(p.Id)).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Permission>> GetByModuleAsync(string moduleId, CancellationToken ct = default) =>
        await db.Permissions.Where(p => p.ModuleId == moduleId).OrderBy(p => p.Action).ToListAsync(ct);

    public async Task<IReadOnlyList<string>> GetPermissionKeysForUserAsync(Guid userId, CancellationToken ct = default)
    {
        return await db.UserRoles
            .Where(ur => ur.UserId == userId)
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.ModuleId + "." + rp.Permission.Action)
            .Distinct()
            .ToListAsync(ct);
    }
}

