using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class RoleRepository(IdentityDbContext db) : IRoleRepository
{
    private IQueryable<Role> BaseQuery =>
        db.Roles
          .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
          .Include(r => r.UserRoles);

    public Task<Role?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<Role?> GetByNameAsync(string name, Guid? tenantId = null, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(r => r.Name == name && r.TenantId == tenantId, ct);

    public async Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken ct = default) =>
        await BaseQuery.OrderBy(r => r.Name).ToListAsync(ct);

    public async Task<PagedResult<Role>> GetPagedAsync(int page, int pageSize, string? search = null, Guid? tenantScope = null, CancellationToken ct = default)
    {
        var query = db.Roles
            .Include(r => r.UserRoles)
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .AsQueryable();

        // Tenant scoping: a tenant only ever sees its own roles. Null scope (super-admin) = all.
        if (tenantScope.HasValue)
            query = query.Where(r => r.TenantId == tenantScope.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(r =>
                EF.Functions.Like(r.Name, pattern) ||
                EF.Functions.Like(r.Description, pattern));
        }

        query = query.OrderBy(r => r.Name);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<Role>.Create(items, total, page, pageSize);
    }

    public Task<bool> NameExistsAsync(string name, Guid? excludeId = null, Guid? tenantScope = null, CancellationToken ct = default) =>
        db.Roles.AnyAsync(r => r.Name == name
            && (excludeId == null || r.Id != excludeId)
            && r.TenantId == tenantScope, ct);

    public void Add(Role role)    => db.Roles.Add(role);
    public void Update(Role role) => db.Roles.Update(role);
    public void Remove(Role role) => db.Roles.Remove(role);
}

