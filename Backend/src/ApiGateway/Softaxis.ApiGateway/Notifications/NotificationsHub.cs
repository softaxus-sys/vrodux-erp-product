using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Softaxis.ApiGateway.Notifications;

/// <summary>
/// The user's own realtime channel. Every connection is placed in exactly one group — its own —
/// derived server-side from the connection's JWT.
///
/// <para><b>Why membership is automatic rather than a client "join" call (Restaurant and Support both
/// make the client ask):</b> those hubs join SHARED rooms, so the client naming the room is the whole
/// point. Here the only room a connection may ever be in is its own, so taking the identity from the
/// token instead of from the client removes any chance of asking for someone else's — and it survives
/// reconnects for free, since OnConnectedAsync fires again on every reconnect.</para>
///
/// <para><b>⚠️ Both the tenant and the user are read from <see cref="HubCallerContext.User"/>, never
/// from an injected service.</b> This is not a style preference — it is the fix for a real bug.
/// <c>ITenantContext</c> is a SCOPED service populated by <c>TenantContextMiddleware</c> during an
/// HTTP request. SignalR invokes hub methods (including OnConnectedAsync) in a scope created from the
/// ROOT provider, not the request scope, so a hub that injects it receives a fresh, unresolved
/// instance whose TenantId is null. The connection then joins no group at all and every push is
/// silently dropped — the notification row still saves, so the bell fills up on the next poll and the
/// realtime channel looks "connected" while delivering nothing. Claims are carried on the connection
/// itself, so they are the only identity source that is correct here.</para>
///
/// <para>The group key includes the tenant so the same user id in two workspaces can never cross.</para>
/// </summary>
[Authorize]
public sealed class NotificationsHub(ILogger<NotificationsHub> logger) : Hub
{
    public static string UserGroup(Guid tenantId, Guid userId) => $"notify:{tenantId}:{userId}";

    public override async Task OnConnectedAsync()
    {
        var userId   = ClaimGuid(ClaimTypes.NameIdentifier, "sub");
        var tenantId = ClaimGuid("tenant_id");

        if (userId is { } u && tenantId is { } t)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(t, u));
        }
        else
        {
            // A connection that resolves to nobody stays in no group: it receives nothing, rather
            // than being refused, and the bell's own polling still covers that user. Logged at
            // warning because it is indistinguishable from "working" on the client — which is
            // exactly how the scoped-ITenantContext bug above stayed invisible.
            logger.LogWarning(
                "NotificationsHub: connection {ConnectionId} joined no group (user={User}, tenant={Tenant}); " +
                "realtime pushes will not reach it.",
                Context.ConnectionId, userId, tenantId);
        }

        await base.OnConnectedAsync();
    }

    /// <summary>First claim that parses as a GUID, in the order given.</summary>
    private Guid? ClaimGuid(params string[] claimTypes)
    {
        foreach (var type in claimTypes)
        {
            if (Guid.TryParse(Context.User?.FindFirstValue(type), out var id)) return id;
        }
        return null;
    }
}
