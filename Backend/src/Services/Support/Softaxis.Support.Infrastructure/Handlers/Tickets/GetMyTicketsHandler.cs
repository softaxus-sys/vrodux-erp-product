using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Tickets.Dtos;
using Softaxis.Support.Application.Tickets.Queries;
using Softaxis.Support.Infrastructure.Persistence;

namespace Softaxis.Support.Infrastructure.Handlers.Tickets;

/// <summary>
/// Explicit filter on the CALLER'S OWN tenant id — never the ambient tenant machinery every
/// other service uses (this schema carries none). Any user in the tenant sees the tenant's whole
/// ticket history, same as any teammate can see what was raised with a vendor's support desk.
/// </summary>
internal sealed class GetMyTicketsHandler(SupportDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetMyTicketsQuery, IReadOnlyList<TicketSummaryDto>>
{
    public async Task<Result<IReadOnlyList<TicketSummaryDto>>> Handle(GetMyTicketsQuery query, CancellationToken ct)
    {
        if (currentUser.TenantId is null)
            return Result.Success<IReadOnlyList<TicketSummaryDto>>([]);

        var tickets = await db.Tickets.AsNoTracking()
            .Where(t => t.RequestingTenantId == currentUser.TenantId.Value)
            .Where(t => query.Status == null || t.Status == query.Status)
            .OrderByDescending(t => t.UpdatedAt ?? t.CreatedAt)
            .ToListAsync(ct);

        var counts = await MessageCounts(db, tickets.Select(t => t.Id), ct);
        return Result.Success<IReadOnlyList<TicketSummaryDto>>(
            tickets.Select(t => TicketMappings.ToSummaryDto(t, counts.GetValueOrDefault(t.Id))).ToList());
    }

    internal static async Task<Dictionary<Guid, int>> MessageCounts(SupportDbContext db, IEnumerable<Guid> ticketIds, CancellationToken ct)
    {
        var ids = ticketIds.ToList();
        if (ids.Count == 0) return [];
        return await db.Messages.AsNoTracking()
            .Where(m => ids.Contains(m.TicketId))
            .GroupBy(m => m.TicketId)
            .Select(g => new { TicketId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TicketId, x => x.Count, ct);
    }
}
