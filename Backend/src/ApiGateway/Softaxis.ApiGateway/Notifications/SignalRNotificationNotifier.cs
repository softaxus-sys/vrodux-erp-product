using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;

namespace Softaxis.ApiGateway.Notifications;

/// <summary>
/// SignalR implementation of the shared realtime abstraction. Lives in the gateway because that is
/// where the hub is hosted, and keeps BuildingBlocks free of any SignalR dependency.
/// </summary>
public sealed class SignalRNotificationNotifier(
    IHubContext<NotificationsHub> hub,
    ILogger<SignalRNotificationNotifier> logger) : INotificationRealtimeNotifier
{
    public async Task PushAsync(Guid tenantId, IReadOnlyList<NotificationPayload> payloads, CancellationToken ct = default)
    {
        // One send per recipient, not one per alert: a fan-out to 30 people that also gave each of
        // them 30 sends would be 900 messages for 30 alerts.
        foreach (var group in payloads.GroupBy(p => p.UserId))
            await SendAsync(NotificationsHub.UserGroup(tenantId, group.Key), "notify", group.ToArray(), ct);
    }

    public Task PushReadStateAsync(Guid tenantId, Guid userId, int unreadCount, CancellationToken ct = default) =>
        SendAsync(NotificationsHub.UserGroup(tenantId, userId), "readState", unreadCount, ct);

    private async Task SendAsync(string group, string eventName, object payload, CancellationToken ct)
    {
        try
        {
            await hub.Clients.Group(group).SendAsync(eventName, payload, ct);
        }
        catch (Exception ex)
        {
            // Best-effort by contract — the alert is already stored, so the worst case is that the
            // recipient sees it on their next poll instead of instantly.
            logger.LogWarning(ex, "NotificationsHub: failed to push {Event}.", eventName);
        }
    }
}
