namespace Softaxis.Support.Application.Abstractions;

/// <summary>
/// Pushes a bare "something changed, go re-fetch" signal — never ticket content itself — to
/// connected clients. Mirrors Restaurant's IRestaurantRealtimeNotifier convention exactly, with
/// one deliberate difference: Restaurant broadcasts to every connected client because its blast
/// radius is one tenant's own kitchen/table staff. Support's blast radius is the WHOLE platform,
/// so a broadcast-to-everyone would mean every open ticket drawer on every tenant re-fetching on
/// every message anywhere — the implementation (SignalRSupportNotifier) targets SignalR GROUPS
/// instead (one ticket's room, or the agent queue), joined only after the same access check the
/// REST endpoints themselves apply (see SupportHub). The payload staying signal-only, not data,
/// means a stale/wrong group membership can only ever cause a missed or wasted refresh — never a
/// content leak, since the client always re-fetches over its own authenticated REST call.
/// </summary>
public interface ISupportRealtimeNotifier
{
    /// <summary>A message was added, or the ticket's status/assignment/priority changed —
    /// push to that ticket's own room.</summary>
    Task NotifyTicketUpdatedAsync(Guid ticketId, CancellationToken ct = default);

    /// <summary>A ticket was created, or any ticket's status/assignment changed — push to every
    /// connected agent watching the queue.</summary>
    Task NotifyQueueChangedAsync(CancellationToken ct = default);
}
