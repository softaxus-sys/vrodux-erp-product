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

    public Task<Role?> GetByNameAsync(string name, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(r => r.Name == name, ct);

    public async Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken ct = default) =>
        await BaseQuery.OrderBy(r => r.Name).ToListAsync(ct);

    public async Task<PagedResult<Role>> GetPagedAsync(int page, int pageSize, string? search = null, CancellationToken ct = default)
    {
        var query = db.Roles
            .Include(r => r.UserRoles)
            .Include(r => r.RolePermissions).ThenInclude(rp => rp.Permission)
            .AsQueryable();

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

    public Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken ct = default) =>
        db.Roles.AnyAsync(r => r.Name == name && (excludeId == null || r.Id != excludeId), ct);

    public void Add(Role role)    => db.Roles.Add(role);
    public void Update(Role role) => db.Roles.Update(role);
    public void Remove(Role role) => db.Roles.Remove(role);
}

