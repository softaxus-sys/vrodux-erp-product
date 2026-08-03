using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Softaxis.Restaurant.Application.Abstractions;

namespace Softaxis.Restaurant.API.Realtime;

public sealed class SignalRRestaurantNotifier(
    IHubContext<RestaurantHub> hub, ILogger<SignalRRestaurantNotifier> logger) : IRestaurantRealtimeNotifier
{
    public Task NotifyKitchenChangedAsync(CancellationToken ct = default) => SendAsync("kitchenChanged", ct);
    public Task NotifyTablesChangedAsync(CancellationToken ct = default) => SendAsync("tablesChanged", ct);

    private async Task SendAsync(string eventName, CancellationToken ct)
    {
        try
        {
            await hub.Clients.All.SendAsync(eventName, ct);
        }
        catch (Exception ex)
        {
            // Best-effort — a broadcast hiccup must never fail the command that triggered it.
            // Connected clients simply miss one push and pick the change up on their next poll.
            logger.LogWarning(ex, "RestaurantHub: failed to broadcast {Event}.", eventName);
        }
    }
}
