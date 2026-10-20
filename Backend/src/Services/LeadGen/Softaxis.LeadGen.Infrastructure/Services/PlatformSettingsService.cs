using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

/// <summary>
/// Reads the platform settings row, creating it with defaults on first use. Cached for a minute —
/// every search, reveal and send consults it, and it changes only when the super admin edits it,
/// which drops the cache straight away.
/// </summary>
public interface IPlatformSettings
{
    Task<PlatformSettings> GetAsync(CancellationToken ct);
    void Invalidate();
}

internal sealed class PlatformSettingsService(LeadGenDbContext db, IMemoryCache cache) : IPlatformSettings
{
    private const string Key = "leadgen:platform-settings";

    public async Task<PlatformSettings> GetAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(Key, out PlatformSettings? cached) && cached is not null) return cached;

        var row = await db.PlatformSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        if (row is null)
        {
            try
            {
                var created = PlatformSettings.CreateDefault();
                db.PlatformSettings.Add(created);
                await db.SaveChangesAsync(ct);
                row = created;
            }
            catch (DbUpdateException)
            {
                // Two requests created it at once; one of them won, read that one.
                db.ChangeTracker.Clear();
                row = await db.PlatformSettings.AsNoTracking().FirstAsync(ct);
            }
        }

        cache.Set(Key, row, TimeSpan.FromMinutes(1));
        return row;
    }

    public void Invalidate() => cache.Remove(Key);
}
