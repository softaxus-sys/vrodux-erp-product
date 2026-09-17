using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Softaxis.Support.Application.Abstractions;

namespace Softaxis.Support.API.Realtime;

public sealed class SignalRSupportNotifier(
    IHubContext<SupportHub> hub, ILogger<SignalRSupportNotifier> logger) : ISupportRealtimeNotifier
{
    public Task NotifyTicketUpdatedAsync(Guid ticketId, CancellationToken ct = default) =>
        SendAsync(hub.Clients.Group(SupportHub.TicketGroup(ticketId)), "ticketUpdated", ct);

    public Task NotifyQueueChangedAsync(CancellationToken ct = default) =>
        SendAsync(hub.Clients.Group(SupportHub.QueueGroup), "queueChanged", ct);

    private async Task SendAsync(IClientProxy clients, string eventName, CancellationToken ct)
    {
        try
        {
            await clients.SendAsync(eventName, ct);
        }
        catch (Exception ex)
        {
            // Best-effort — a broadcast hiccup must never fail the command that triggered it.
            // Connected clients simply miss one push and pick the change up on their next poll.
            logger.LogWarning(ex, "SupportHub: failed to broadcast {Event}.", eventName);
        }
    }
}
