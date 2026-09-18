using Softaxis.Support.Application.Tickets;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Application.Tickets.Queries;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>
/// Every tenant's tickets, for the operator's own agents. The controller already requires
/// `support.tickets.view`; this handler ALSO requires the caller's own tenant to be the
/// configured operator tenant (<see cref="ISupportAccessGuard"/>) — belt and suspenders, so a
/// permission key alone is never sufficient for this cross-tenant read.
/// </summary>
internal sealed class GetTicketQueueHandler(SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard)
    : IQueryHandler<GetTicketQueueQuery, IReadOnlyList<TicketSummaryDto>>
{
    public async Task<Result<IReadOnlyList<TicketSummaryDto>>> Handle(GetTicketQueueQuery query, CancellationToken ct)
    {
        if (!TicketAccess.IsAgent(currentUser, guard))
            return Result.Failure<IReadOnlyList<TicketSummaryDto>>(
                Error.Custom("Support.Forbidden", "Only Softaxis support agents can view the ticket queue."));

        var tickets = await db.Tickets.AsNoTracking()
            .Where(t => query.Status == null || t.Status == query.Status)
            .Where(t => query.Category == null || t.Category == query.Category)
            .Where(t => query.AssignedToUserId == null || t.AssignedToUserId == query.AssignedToUserId)
            .OrderByDescending(t => t.UpdatedAt ?? t.CreatedAt)
            .ToListAsync(ct);

        var counts = await GetMyTicketsHandler.MessageCounts(db, tickets.Select(t => t.Id), ct);
        return Result.Success<IReadOnlyList<TicketSummaryDto>>(
            tickets.Select(t => TicketMappings.ToSummaryDto(t, counts.GetValueOrDefault(t.Id))).ToList());
    }
}
