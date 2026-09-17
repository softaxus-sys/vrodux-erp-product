using Softaxis.Support.Application.Tickets;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>Agent-only — status is the queue's own workflow, a requesting tenant only ever sees
/// it, never sets it directly (they express intent by replying, e.g. into waiting_on_customer's
/// counterpart "back to the agent").</summary>
internal sealed class ChangeTicketStatusHandler(
    SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard, ISupportRealtimeNotifier realtime)
    : ICommandHandler<ChangeTicketStatusCommand>
{
    public async Task<Result> Handle(ChangeTicketStatusCommand cmd, CancellationToken ct)
    {
        if (!TicketAccess.IsAgent(currentUser, guard))
            return Result.Failure(Error.Custom("Support.Forbidden", "Only Softaxis support agents can change ticket status."));

        var ticket = await db.Tickets.FindAsync([cmd.TicketId], ct);
        if (ticket is null)
            return Result.Failure(Error.NotFoundById("SupportTicket", cmd.TicketId));

        if (!ticket.ChangeStatus(cmd.Status))
            return Result.Failure(Error.Custom("SupportTicket.InvalidTransition",
                $"Cannot move a ticket from '{ticket.Status}' to '{cmd.Status}'."));

        await db.SaveChangesAsync(ct);

        await realtime.NotifyTicketUpdatedAsync(ticket.Id, ct);
        await realtime.NotifyQueueChangedAsync(ct);

        return Result.Success();
    }
}
