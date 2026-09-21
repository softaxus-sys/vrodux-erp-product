using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Softaxis.BuildingBlocks.Infrastructure.Notifications;

/// <summary>
/// Moves CRM's own notification history into the shared store, once.
///
/// <para>CRM shipped a module-scoped notification table before this existed. Leaving those rows behind
/// would empty every user's bell the day the shared feed goes live — the alerts would still be in the
/// database, just in a table nothing reads any more.</para>
///
/// <para><b>Idempotent by construction:</b> each copied row keeps its ORIGINAL id, so the
/// <c>NOT EXISTS</c> guard makes a second run a no-op rather than a duplicate. No "has this run?" flag
/// to get out of step with reality.</para>
///
/// <para>Raw SQL, not EF: both tables live in the same physical database under different schemas, and
/// a set-based INSERT…SELECT is one statement instead of loading every row of every tenant into
/// memory. Tenant ids are carried across as-is — including NULL ones, which were already invisible and
/// stay that way rather than being guessed at.</para>
/// </summary>
internal static class NotificationBackfill
{
    public static async Task CopyLegacyCrmNotificationsAsync(NotificationsDbContext db, IServiceProvider services)
    {
        var logger = services.GetService<ILoggerFactory>()?.CreateLogger("NotificationBackfill");
        try
        {
            // Absent on a fresh deployment that never ran the CRM module's own migration.
            var legacyExists = await db.Database
                .SqlQueryRaw<int>("SELECT CASE WHEN OBJECT_ID('[crm].[notifications]', 'U') IS NULL THEN 0 ELSE 1 END AS [Value]")
                .SingleAsync();
            if (legacyExists == 0) return;

            var copied = await db.Database.ExecuteSqlRawAsync("""
                INSERT INTO [notifications].[notifications]
                    (Id, UserId, Module, [Event], [Type], Title, [Message], [Link],
                     RelatedToType, RelatedToId, ReadAt, CreatedAt, TenantId)
                SELECT c.Id, c.UserId, 'crm',
                       -- The legacy table had no event key; every row it produced was an inbound lead.
                       'lead.received',
                       c.[Type], c.Title, c.[Message], c.[Link],
                       c.RelatedToType, c.RelatedToId, c.ReadAt, c.CreatedAt, c.TenantId
                FROM [crm].[notifications] c
                WHERE NOT EXISTS (
                    SELECT 1 FROM [notifications].[notifications] n WHERE n.Id = c.Id)
                """);

            if (copied > 0)
                logger?.LogInformation("Notification backfill: copied {Count} CRM alerts into the shared store.", copied);
        }
        catch (Exception ex)
        {
            // History is nice to keep, but not at the cost of the gateway failing to start.
            logger?.LogWarning(ex, "Notification backfill skipped; new alerts are unaffected.");
        }
    }
}
