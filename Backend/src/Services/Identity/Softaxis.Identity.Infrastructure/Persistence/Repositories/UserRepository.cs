using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class UserRepository(IdentityDbContext db) : IUserRepository
{
    private IQueryable<User> BaseQuery =>
        db.Users
          .Include(u => u.UserRoles)
            .ThenInclude(ur => ur.Role)
            .ThenInclude(r => r.RolePermissions)
            .ThenInclude(rp => rp.Permission)
          .Include(u => u.UserPermissions)
            .ThenInclude(up => up.Permission);

    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant(), ct);

    public Task<User?> GetByUsernameAsync(string username, CancellationToken ct = default) =>
        BaseQuery.FirstOrDefaultAsync(u => u.Username == username, ct);

    public Task<bool> EmailExistsAsync(string email, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.Email == email.ToLowerInvariant(), ct);

    public Task<bool> UsernameExistsAsync(string username, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.Username == username, ct);

    public async Task<PagedResult<User>> GetPagedAsync(
        int page, int pageSize,
        string? search = null,
        string? sortBy = null, bool sortDesc = false,
        Guid? tenantId = null,
        CancellationToken ct = default)
    {
        var query = db.Users.AsNoTracking()
            .Include(u => u.UserRoles)
            .AsQueryable();

        // Tenant scoping — non-super-admin callers only see their own tenant's users.
        if (tenantId.HasValue)
            query = query.Where(u => u.TenantId == tenantId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(u =>
                EF.Functions.Like(u.Username,  pattern) ||
                EF.Functions.Like(u.FirstName, pattern) ||
                EF.Functions.Like(u.LastName,  pattern) ||
                EF.Functions.Like(u.Email,     pattern));
        }

        query = (sortBy?.ToLower(), sortDesc) switch
        {
            ("email",    false) => query.OrderBy(u => u.Email),
            ("email",    true)  => query.OrderByDescending(u => u.Email),
            ("username", false) => query.OrderBy(u => u.Username),
            ("username", true)  => query.OrderByDescending(u => u.Username),
            ("createdat",false) => query.OrderBy(u => u.CreatedAt),
            ("createdat",true)  => query.OrderByDescending(u => u.CreatedAt),
            _                   => query.OrderByDescending(u => u.CreatedAt),
        };

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<User>.Create(items, total, page, pageSize);
    }

    public Task<int> CountByTenantAsync(Guid tenantId, CancellationToken ct = default) =>
        db.Users.CountAsync(u => u.TenantId == tenantId, ct);

    public void Add(User user)    => db.Users.Add(user);
    public void Update(User user) => db.Users.Update(user);
    public void Remove(User user) => db.Users.Remove(user);
}

