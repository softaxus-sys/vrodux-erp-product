using Softaxis.Support.Application.Tickets;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Application.Tickets.Queries;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

internal sealed class GetTicketByIdHandler(SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard)
    : IQueryHandler<GetTicketByIdQuery, TicketDetailDto>
{
    public async Task<Result<TicketDetailDto>> Handle(GetTicketByIdQuery query, CancellationToken ct)
    {
        var ticket = await db.Tickets.FindAsync([query.Id], ct);
        // NotFound for both "doesn't exist" and "you can't see it" — never leak existence.
        if (ticket is null || !TicketAccess.CanRead(ticket, currentUser, guard))
            return Result.Failure<TicketDetailDto>(Error.NotFoundById("SupportTicket", query.Id));

        var messages    = await db.Messages.AsNoTracking().Where(m => m.TicketId == ticket.Id).ToListAsync(ct);
        var history     = await db.AssignmentHistory.AsNoTracking().Where(a => a.TicketId == ticket.Id).ToListAsync(ct);
        var attachments = await db.Attachments.AsNoTracking().Where(a => a.TicketId == ticket.Id).ToListAsync(ct);

        return Result.Success(TicketMappings.ToDetailDto(ticket, messages, history, attachments));
    }
}
