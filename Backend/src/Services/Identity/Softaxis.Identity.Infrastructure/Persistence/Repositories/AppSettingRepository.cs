using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class AppSettingRepository(IdentityDbContext db) : IAppSettingRepository
{
    public Task<List<AppSetting>> GetAllForUserAsync(string userId, CancellationToken ct = default) =>
        db.AppSettings
          .AsNoTracking()
          .Where(s => s.UserId == null || s.UserId == userId)
          .ToListAsync(ct);

    public Task<List<AppSetting>> GetByCategoryAsync(string category, string? userId, CancellationToken ct = default)
    {
        var query = db.AppSettings.Where(s => s.Category == category);
        query = userId is null
            ? query.Where(s => s.UserId == null)
            : query.Where(s => s.UserId == userId);
        return query.ToListAsync(ct);
    }

    public void Add(AppSetting setting) => db.AppSettings.Add(setting);
}
