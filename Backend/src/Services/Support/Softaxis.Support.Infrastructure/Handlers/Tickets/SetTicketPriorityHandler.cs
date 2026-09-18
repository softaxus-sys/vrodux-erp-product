using Softaxis.Support.Application.Tickets;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Commands;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

internal sealed class SetTicketPriorityHandler(
    SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard, ISupportRealtimeNotifier realtime)
    : ICommandHandler<SetTicketPriorityCommand>
{
    public async Task<Result> Handle(SetTicketPriorityCommand cmd, CancellationToken ct)
    {
        if (!TicketAccess.IsAgent(currentUser, guard))
            return Result.Failure(Error.Custom("Support.Forbidden", "Only Softaxis support agents can change ticket priority."));

        var ticket = await db.Tickets.FindAsync([cmd.TicketId], ct);
        if (ticket is null)
            return Result.Failure(Error.NotFoundById("SupportTicket", cmd.TicketId));

        ticket.SetPriority(cmd.Priority);
        await db.SaveChangesAsync(ct);

        await realtime.NotifyTicketUpdatedAsync(ticket.Id, ct);
        await realtime.NotifyQueueChangedAsync(ct);

        return Result.Success();
    }
}
