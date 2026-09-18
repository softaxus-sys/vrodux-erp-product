using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.API.Realtime;

/// <summary>
/// Realtime push channel for support tickets — see ISupportRealtimeNotifier for why this is
/// group-targeted rather than broadcast-to-everyone like Restaurant's hub. Clients call
/// <see cref="JoinTicket"/>/<see cref="JoinQueue"/> after connecting; every join is access-checked
/// with the SAME rules the REST endpoints enforce (TicketAccess), so a connection can only ever
/// land in a room it was already allowed to read via HTTP. Server-to-client push carries no
/// content, only a "go re-fetch" signal — see ISupportRealtimeNotifier's own remarks.
/// </summary>
[Authorize]
public sealed class SupportHub(SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard) : Hub
{
    public static string TicketGroup(Guid ticketId) => $"support-ticket:{ticketId}";
    public const string QueueGroup = "support-queue";

    public async Task JoinTicket(string ticketId)
    {
        if (!Guid.TryParse(ticketId, out var id)) return;
        var ticket = await db.Tickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
        if (ticket is null || !TicketAccess.CanRead(ticket, currentUser, guard)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, TicketGroup(id));
    }

    public async Task LeaveTicket(string ticketId)
    {
        if (!Guid.TryParse(ticketId, out var id)) return;
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, TicketGroup(id));
    }

    public async Task JoinQueue()
    {
        if (TicketAccess.IsAgent(currentUser, guard))
            await Groups.AddToGroupAsync(Context.ConnectionId, QueueGroup);
    }
}
