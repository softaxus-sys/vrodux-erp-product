using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class BranchRepository(IdentityDbContext db) : IBranchRepository
{
    public async Task<PagedResult<Branch>> GetPagedAsync(
        int page, int pageSize, string? status, Guid? tenantScope, CancellationToken ct = default)
    {
        var query = Scoped(tenantScope).AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(b => b.Status == status);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(b => b.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return PagedResult<Branch>.Create(items, total, page, pageSize);
    }

    public Task<Branch?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Branches.FirstOrDefaultAsync(b => b.Id == id, ct);

    public Task<bool> CodeExistsAsync(string code, Guid? tenantScope, CancellationToken ct = default) =>
        Scoped(tenantScope).AnyAsync(b => b.Code == code, ct);

    public Task<bool> CodeExistsExcludingAsync(string code, Guid excludeId, Guid? tenantScope, CancellationToken ct = default) =>
        Scoped(tenantScope).AnyAsync(b => b.Code == code && b.Id != excludeId, ct);

    // Split on HasValue so the null case emits "TenantId IS NULL" rather than "= @p", which
    // never matches NULL in SQL (the EF null-parameter pitfall the roles fix hit).
    private IQueryable<Branch> Scoped(Guid? tenantScope) =>
        tenantScope.HasValue
            ? db.Branches.Where(b => b.TenantId == tenantScope.Value)
            : db.Branches.Where(b => b.TenantId == null);

    public void Add(Branch branch) => db.Branches.Add(branch);
}
