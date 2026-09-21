using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Notifications;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;

namespace Softaxis.BuildingBlocks.Infrastructure.Notifications;

/// <summary>
/// Stores each alert, then pushes it to whichever of the recipient's tabs are open.
///
/// <para><b>Store first, push second, and never throw.</b> Pushing first would mean a crash in between
/// shows a toast for an alert the bell will never list — the user sees something once and can never
/// find it again. Storing first means the worst case is an alert that arrives quietly and is seen on
/// the next visit. The whole method is guarded because callers are real work (assigning a lead,
/// approving a payroll) that must not roll back over a notification.</para>
/// </summary>
public sealed class NotificationPublisher(
    NotificationsDbContext db,
    INotificationRealtimeNotifier realtime,
    ILogger<NotificationPublisher> logger) : INotificationDispatcher
{
    /// <summary>Guards against a mis-resolved recipient query flooding one save with thousands of rows.</summary>
    private const int MaxPerPublish = 500;

    public Task PublishAsync(NotificationRequest request, CancellationToken ct = default) =>
        PublishManyAsync([request], ct);

    public async Task PublishManyAsync(IEnumerable<NotificationRequest> requests, CancellationToken ct = default)
    {
        try
        {
            var accepted = requests
                // Nobody wants to be told about what they just did themselves. Enforced here rather
                // than at each call site so a new trigger cannot forget it.
                .Where(r => r.RecipientUserId != Guid.Empty && r.RecipientUserId != r.ActorUserId)
                // The same person can legitimately match a recipient query twice (owner AND team lead).
                .GroupBy(r => (r.RecipientUserId, r.Event, r.RelatedToId))
                .Select(g => g.First())
                .Take(MaxPerPublish)
                .ToList();

            if (accepted.Count == 0) return;

            var byTenant = new Dictionary<Guid, List<NotificationPayload>>();

            foreach (var r in accepted)
            {
                var n = new Notification(r.RecipientUserId, r.Module, r.Event, r.Type,
                    r.Title, r.Message, r.Link, r.RelatedToType, r.RelatedToId);
                db.Notifications.Add(n);

                // A caller with no ambient tenant (background sweep, anonymous webhook) passes the
                // tenant explicitly. Without this the row saves with TenantId = NULL and is invisible
                // to the very user it is for — the filter is `TenantId == ambient`, and NULL never matches.
                var tenantId = r.TenantId ?? TenantAmbient.TenantId;
                if (r.TenantId is { } explicitTenant)
                    db.Entry(n).Property(TenantIsolation.Column).CurrentValue = explicitTenant;

                if (tenantId is not { } t) continue;
                if (!byTenant.TryGetValue(t, out var list)) byTenant[t] = list = [];
                list.Add(new NotificationPayload(n.Id, n.UserId, n.Module, n.Event, n.Type,
                    n.Title, n.Message, n.Link, n.RelatedToType, n.RelatedToId, false, n.CreatedAt));
            }

            await db.SaveChangesAsync(ct);

            foreach (var (tenantId, payloads) in byTenant)
                await realtime.PushAsync(tenantId, payloads, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to publish notifications; the work that triggered them is unaffected.");
        }
    }
}
