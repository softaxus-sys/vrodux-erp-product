using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Services;

internal interface IVacancyAlertNotifier
{
    /// <summary>Raises "about to fall vacant" alerts for the ambient workspace. Returns how many units were announced.</summary>
    Task<int> RunForCurrentTenantAsync(CancellationToken ct);
}

/// <summary>
/// Tells staff that a rented unit's rental period is nearly over, so it can be re-let before it
/// sits empty.
///
/// <para>Bell and realtime only — no email. This is an internal heads-up for the agency, not a
/// notice to the tenant; the tenant-facing expiry email is <see cref="RentAlertSender"/>'s job and
/// has its own switch.</para>
///
/// <para>Covers every unit marked rented, <b>including ones removed from the stock list</b>. A
/// listing is taken down once it is let, but the tenancy behind it still ends, and that is exactly
/// the unit that needs to come back onto the market.</para>
/// </summary>
internal sealed class VacancyAlertNotifier(
    RealEstateDbContext db,
    INotificationDispatcher notifications,
    ILogger<VacancyAlertNotifier> logger) : IVacancyAlertNotifier
{
    private sealed class AdminRow { public Guid UserId { get; set; } }

    public async Task<int> RunForCurrentTenantAsync(CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId) return 0;

        // The same lead times and clock as the lease-expiry emails, so the two cannot disagree
        // about when a tenancy is "nearly over". Not gated on the email switch: turning tenant
        // emails off should not also silence the agency's own heads-up.
        var settings = await RentAlertSettingsStore.FindAsync(db, ct) ?? new RentAlertSettings();
        var today    = settings.Today();

        // 0 is always in play, so a tenancy ending today is announced even when the ladder stops short.
        var offsets = settings.ExpiryOffsets.Append(0).Distinct().ToList();

        // No IsDeleted filter, on purpose — see the class comment.
        var units = await db.PropertyUnits.Where(u => u.Status == "rented").ToListAsync(ct);
        if (units.Count == 0) return 0;

        // A lease on file is the authority for when the tenancy ends; the unit's own date is the
        // fallback for stock that was imported as "rented" with no lease behind it.
        var unitIds = units.Select(u => u.Id).ToList();
        var leaseEnds = (await db.LeaseContracts.AsNoTracking()
                .Where(c => !c.IsDeleted && c.Status == "active" && unitIds.Contains(c.UnitId))
                .Select(c => new { c.UnitId, c.EndDate })
                .ToListAsync(ct))
            .GroupBy(c => c.UnitId)
            .ToDictionary(g => g.Key, g => g.Select(c => c.EndDate).Max()!);

        var propertyIds = units.Select(u => u.PropertyId).Distinct().ToList();
        var properties = await db.Properties.AsNoTracking()
            .Where(p => propertyIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.IsDeleted })
            .ToDictionaryAsync(p => p.Id, ct);

        IReadOnlyList<Guid>? audience = null;
        var requests = new List<NotificationRequest>();
        var announced = 0;

        foreach (var u in units)
        {
            var endDate = leaseEnds.GetValueOrDefault(u.Id) ?? u.RentedUntil ?? RentedTill.FromText(u.PriceLabel);

            // Last resort: a rented unit with no recorded end is taken to run in one-year terms
            // from the date it was listed. An assumption, so the alert says so.
            var estimated = false;
            if (endDate is null)
            {
                endDate = NextAnniversary(u.ListedOn, today);
                estimated = endDate is not null;
            }
            if (endDate is null) continue;

            // Already past: the alert is a warning that vacancy is coming, not a daily reminder
            // that a status was never updated.
            if (DaysBetween(today, endDate) is not { } daysLeft || daysLeft < 0) continue;
            if (TightestRung(offsets, daysLeft) is not { } rung) continue;

            var key = endDate + ":" + rung.ToString(CultureInfo.InvariantCulture);
            if (u.VacancyAlertKey == key) continue;

            audience ??= await AdminsAsync(tenantId, ct);

            properties.TryGetValue(u.PropertyId, out var property);
            var building = property?.Name ?? "A property";
            var removed  = u.IsDeleted || property is null || property.IsDeleted;

            var to = audience.ToHashSet();
            if (u.AgentUserId is { } agent) to.Add(agent);

            foreach (var userId in to)
            {
                // Safe to name the unit: the only recipients are the listing's own agent and the
                // administrators, who are exactly the people a restricted listing is visible to.
                var what = building + " · Unit " + u.UnitNumber;

                requests.Add(new NotificationRequest(
                    RecipientUserId: userId,
                    Module:          NotificationModules.RealEstate,
                    Event:           NotificationEvents.UnitVacating,
                    Title:           what + " " + When(daysLeft),
                    Message:         (estimated
                                         ? "The annual rental period is estimated to end on " + endDate
                                           + " (one year from the date listed - no end date is recorded)."
                                         : "The rental period ends on " + endDate + ".")
                                     + (string.IsNullOrWhiteSpace(u.CurrentTenantName) ? "" : " Tenant: " + u.CurrentTenantName + ".")
                                     + (removed ? " This unit is no longer on the stock list." : ""),
                    // A removed unit has no screen to open, and a link that lands on nothing is
                    // worse than no link.
                    Link:            removed ? null : "/real-estate/properties?propertyId=" + u.PropertyId,
                    Type:            "warning",
                    RelatedToType:   "property_unit",
                    RelatedToId:     u.Id,
                    TenantId:        tenantId));
            }

            u.MarkVacancyAlerted(key);
            announced++;
        }

        if (announced == 0) return 0;

        await notifications.PublishManyAsync(requests, ct);
        await db.SaveChangesAsync(ct);

        return announced;
    }

    /// <summary>
    /// The workspace's administrators — holders of its system "Administrator" role. The alert goes
    /// to them and to the listing's agent, nobody else.
    /// </summary>
    private async Task<IReadOnlyList<Guid>> AdminsAsync(Guid tenantId, CancellationToken ct)
    {
        try
        {
            // Cross-schema read; "identity" is a reserved SQL Server keyword and must be bracketed.
            var rows = await db.Database.SqlQuery<AdminRow>($"""
                SELECT DISTINCT u.Id AS UserId
                FROM [identity].[users] u
                JOIN [identity].[user_roles] ur ON ur.UserId = u.Id
                JOIN [identity].[roles] r       ON r.Id = ur.RoleId
                WHERE u.IsDeleted = 0
                  AND u.TenantId  = {tenantId}
                  AND r.TenantId  = {tenantId}
                  AND r.IsSystem  = 1
                  AND r.Name      = 'Administrator'
                """).ToListAsync(ct);

            return rows.Select(r => r.UserId).ToList();
        }
        catch (Exception ex)
        {
            // The agent is still told; losing the admin copy must not lose the alert.
            logger.LogWarning(ex, "Could not resolve administrators for the vacancy alert.");
            return [];
        }
    }

    /// <summary>
    /// The next yearly anniversary of <paramref name="listedOn"/> that is today or later, as
    /// yyyy-MM-dd. Rolls forward rather than stopping at the first year: a unit listed three years
    /// ago and still rented is on its third term, and its first anniversary is long past.
    /// </summary>
    private static string? NextAnniversary(string? listedOn, string today)
    {
        if (!DateTime.TryParse(listedOn, CultureInfo.InvariantCulture, DateTimeStyles.None, out var start)
            || !DateTime.TryParse(today, CultureInfo.InvariantCulture, DateTimeStyles.None, out var now))
            return null;

        // Always from the original date, so a 29 February start does not drift to the 28th for good.
        var years = Math.Max(1, now.Year - start.Year);
        var end = start.AddYears(years);
        if (end.Date < now.Date) end = start.AddYears(years + 1);

        return end.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static string When(int daysLeft) => daysLeft switch
    {
        0 => "becomes vacant today",
        1 => "becomes vacant tomorrow",
        _ => "becomes vacant in " + daysLeft + " days",
    };

    /// <summary>The smallest configured lead time that still covers <paramref name="days"/> — so a
    /// day the service was down delays an alert rather than losing it.</summary>
    private static int? TightestRung(IReadOnlyList<int> offsets, int days)
    {
        int? best = null;
        foreach (var o in offsets)
            if (o >= days && (best is null || o < best)) best = o;
        return best;
    }

    private static int? DaysBetween(string from, string to) =>
        DateTime.TryParse(from, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)
        && DateTime.TryParse(to, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            ? (int)(t.Date - f.Date).TotalDays
            : null;
}
