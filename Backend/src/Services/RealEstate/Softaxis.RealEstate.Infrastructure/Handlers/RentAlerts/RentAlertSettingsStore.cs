using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;

internal static class RentAlertSettingsStore
{
    /// <summary>
    /// The workspace's settings row, created with defaults on first use.
    ///
    /// Deliberately lazy rather than seeded at startup: the startup seed runs with no ambient
    /// tenant, so <c>StampTenantId</c> is a no-op there and the row would land with a NULL tenant
    /// column — invisible to the global query filter, and therefore to the very workspace it was
    /// written for. Module 5g hit exactly that with project members.
    /// </summary>
    public static async Task<RentAlertSettings> GetOrCreateAsync(RealEstateDbContext db, CancellationToken ct)
    {
        var existing = await db.RentAlertSettings.FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        var created = new RentAlertSettings();
        db.RentAlertSettings.Add(created);
        await db.SaveChangesAsync(ct);
        return created;
    }

    /// <summary>Read-only variant for the sweep, which must not create rows for workspaces that
    /// have no leases and have never opened the screen.</summary>
    public static Task<RentAlertSettings?> FindAsync(RealEstateDbContext db, CancellationToken ct) =>
        db.RentAlertSettings.AsNoTracking().FirstOrDefaultAsync(ct);
}
