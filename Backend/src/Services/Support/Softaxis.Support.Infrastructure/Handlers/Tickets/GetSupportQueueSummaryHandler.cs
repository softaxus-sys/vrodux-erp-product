using Softaxis.Support.Application.Tickets;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Application.Tickets.Queries;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

internal sealed class GetSupportQueueSummaryHandler(SupportDbContext db, ICurrentUser currentUser, ISupportAccessGuard guard)
    : IQueryHandler<GetSupportQueueSummaryQuery, SupportQueueSummaryDto>
{
    public async Task<Result<SupportQueueSummaryDto>> Handle(GetSupportQueueSummaryQuery query, CancellationToken ct)
    {
        if (!TicketAccess.IsAgent(currentUser, guard))
            return Result.Failure<SupportQueueSummaryDto>(
                Error.Custom("Support.Forbidden", "Only Softaxis support agents can view queue statistics."));

        var tickets = await db.Tickets.AsNoTracking()
            .Select(t => new { t.Status, t.AssignedToUserId })
            .ToListAsync(ct);

        var myId = currentUser.Id;
        return Result.Success(new SupportQueueSummaryDto(
            tickets.Count,
            tickets.Count(t => t.Status == "open"),
            tickets.Count(t => t.Status == "in_progress"),
            tickets.Count(t => t.Status == "waiting_on_customer"),
            tickets.Count(t => t.AssignedToUserId == null && t.Status != "closed"),
            tickets.Count(t => t.AssignedToUserId == myId && t.Status != "closed" && t.Status != "resolved")));
    }
}
