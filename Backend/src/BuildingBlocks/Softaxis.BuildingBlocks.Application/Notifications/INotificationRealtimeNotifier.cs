namespace Softaxis.BuildingBlocks.Application.Notifications;

/// <summary>
/// Pushes a stored alert to the recipient's connected browser tabs. Implemented over SignalR in the
/// gateway; BuildingBlocks stays free of any SignalR reference so every service can depend on it.
///
/// <para><b>Why this carries the full payload, unlike Support's signal-only hub:</b> Support pushes a
/// bare "go re-fetch" because its rooms are shared and a wrong group membership would leak ticket
/// content. Here the room is one person — derived server-side from the caller's own JWT, never from
/// anything the client sends — so the only thing a member can be shown is their own alert. Sending the
/// payload means the toast appears immediately instead of after a round trip.</para>
/// </summary>
public interface INotificationRealtimeNotifier
{
    /// <summary>Best-effort; must never throw. A user with no open tab simply sees it on their next visit.</summary>
    Task PushAsync(Guid tenantId, IReadOnlyList<NotificationPayload> payloads, CancellationToken ct = default);

    /// <summary>Tells a user's other tabs that their unread count changed (read / read-all elsewhere).</summary>
    Task PushReadStateAsync(Guid tenantId, Guid userId, int unreadCount, CancellationToken ct = default);
}

/// <summary>What a connected client receives. Mirrors the REST DTO so the frontend has one shape.</summary>
public sealed record NotificationPayload(
    Guid    Id,
    Guid    UserId,
    string  Module,
    string  Event,
    string  Type,
    string  Title,
    string  Message,
    string? Link,
    string? RelatedToType,
    Guid?   RelatedToId,
    bool    Read,
    DateTime CreatedAt);
