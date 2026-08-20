using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class AppSettingRepository(IdentityDbContext db) : IAppSettingRepository
{
    /// <summary>
    /// Scope to one tenant. A super-admin (null tenant) sees only the global rows, never a
    /// tenant's private settings — written as an explicit IS NULL branch because comparing a
    /// column to a null parameter never matches in SQL (the same trap fixed in RoleRepository).
    /// </summary>
    private IQueryable<AppSetting> Scoped(Guid? tenantId)
    {
        var q = db.AppSettings.AsNoTracking();
        return tenantId.HasValue
            ? q.Where(s => s.TenantId == tenantId.Value)
            : q.Where(s => s.TenantId == null);
    }

    public Task<List<AppSetting>> GetAllForUserAsync(string userId, Guid? tenantId, CancellationToken ct = default) =>
        Scoped(tenantId)
          .Where(s => s.UserId == null || s.UserId == userId)
          .ToListAsync(ct);

    public Task<List<AppSetting>> GetByCategoryAsync(string category, string? userId, Guid? tenantId, CancellationToken ct = default)
    {
        // Tracked (not AsNoTracking) — the upsert handlers mutate what this returns.
        var query = db.AppSettings.Where(s => s.Category == category);
        query = tenantId.HasValue
            ? query.Where(s => s.TenantId == tenantId.Value)
            : query.Where(s => s.TenantId == null);

        query = userId is null
            ? query.Where(s => s.UserId == null)
            : query.Where(s => s.UserId == userId);

        return query.ToListAsync(ct);
    }

    public void Add(AppSetting setting) => db.AppSettings.Add(setting);
}
