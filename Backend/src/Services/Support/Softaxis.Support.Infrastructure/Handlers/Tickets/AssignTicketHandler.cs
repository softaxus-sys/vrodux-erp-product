using Softaxis.Support.Application.Tickets;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Domain.Entities;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>Agent-only. Logs every assign/reassign/unassign to the handoff history (mirrors
/// CRM's LeadAssignment trail) regardless of whether it's a claim, a reassignment, or clearing it.</summary>
internal sealed class AssignTicketHandler(
    SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard, ISupportRealtimeNotifier realtime)
    : ICommandHandler<AssignTicketCommand>
{
    public async Task<Result> Handle(AssignTicketCommand cmd, CancellationToken ct)
    {
        if (!TicketAccess.IsAgent(currentUser, guard))
            return Result.Failure(Error.Custom("Support.Forbidden", "Only Softaxis support agents can assign tickets."));

        var ticket = await db.Tickets.FindAsync([cmd.TicketId], ct);
        if (ticket is null)
            return Result.Failure(Error.NotFoundById("SupportTicket", cmd.TicketId));

        var fromUserId   = ticket.AssignedToUserId;
        var fromUserName = ticket.AssignedToUserName;

        ticket.Assign(cmd.AssignToUserId, cmd.AssignToUserName);

        db.AssignmentHistory.Add(new TicketAssignment(
            ticket.Id, fromUserId, fromUserName, cmd.AssignToUserId, cmd.AssignToUserName,
            currentUser.Id ?? Guid.Empty, currentUser.Username ?? "Unknown agent", cmd.Note));

        await db.SaveChangesAsync(ct);

        await realtime.NotifyTicketUpdatedAsync(ticket.Id, ct);
        await realtime.NotifyQueueChangedAsync(ct);

        return Result.Success();
    }
}
