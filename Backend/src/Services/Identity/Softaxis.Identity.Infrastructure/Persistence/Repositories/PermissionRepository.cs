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
        // Effective permission set = (rolePerms ∪ userGrants) − userDenies.
        // Deny always wins, so it's applied last.
        var rolePerms = await db.UserRoles
            .Where(ur => ur.UserId == userId)
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.ModuleId + "." + rp.Permission.Action)
            .Distinct()
            .ToListAsync(ct);

        var overrides = await db.UserPermissions
            .Where(up => up.UserId == userId)
            .Select(up => new { Key = up.Permission.ModuleId + "." + up.Permission.Action, up.IsGranted })
            .ToListAsync(ct);

        var grants = overrides.Where(o => o.IsGranted).Select(o => o.Key);
        var denies = overrides.Where(o => !o.IsGranted).Select(o => o.Key).ToHashSet();

        return rolePerms.Union(grants).Where(k => !denies.Contains(k)).Distinct().ToList();
    }
}

