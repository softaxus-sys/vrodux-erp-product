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
        var entry = db.RentAlertSettings.Add(created);
        try
        {
            await db.SaveChangesAsync(ct);
            return created;
        }
        catch (DbUpdateException)
        {
            // Lost a race: a concurrent request created the row between our read and our insert,
            // and IX_RentAlertSettings_OwnerTenantId rejected the duplicate. Two RealEstate
            // endpoints on one page load are enough to hit this — each gets its own scoped
            // context, so neither sees the other's pending insert.
            //
            // Detach first: the failed entry stays Added, and the next SaveChanges on this
            // context would retry the same doomed insert and fail a caller that did nothing wrong.
            entry.State = EntityState.Detached;

            // The winner's row is committed by now, so this read finds it. If it does not, the
            // failure was something other than the race and belongs to the caller.
            var winner = await db.RentAlertSettings.FirstOrDefaultAsync(ct);
            if (winner is null) throw;
            return winner;
        }
    }

    /// <summary>Read-only variant for the sweep, which must not create rows for workspaces that
    /// have no leases and have never opened the screen.</summary>
    public static Task<RentAlertSettings?> FindAsync(RealEstateDbContext db, CancellationToken ct) =>
        db.RentAlertSettings.AsNoTracking().FirstOrDefaultAsync(ct);
}
