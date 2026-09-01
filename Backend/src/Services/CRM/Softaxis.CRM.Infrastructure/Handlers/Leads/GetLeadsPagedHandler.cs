using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class GetLeadsPagedHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetLeadsPagedQuery, PagedResult<LeadDto>>
{
    /// <summary>Statuses that end a lead's life — excluded by the "open" filter. Mirrors the UI.</summary>
    private static readonly string[] ClosedStatuses = ["converted", "unqualified", "lost"];

    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<LeadDto>>> Handle(GetLeadsPagedQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        // Capped so a hand-edited pageSize cannot ask for the whole table back and reintroduce
        // exactly the response this query exists to avoid.
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // Role-based scope first: everything below narrows what the caller may already see.
        var q = access.ScopeReadable(db.Leads.AsNoTracking().Where(x => !x.IsDeleted));

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            q = query.Status == "open"
                ? q.Where(x => !ClosedStatuses.Contains(x.Status))
                : q.Where(x => x.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Source) && query.Source != "all")
            q = q.Where(x => x.Source == query.Source);

        if (!string.IsNullOrWhiteSpace(query.Assignee) && query.Assignee != "all")
        {
            if (query.Assignee == "unassigned")
                q = q.Where(x => x.AssignedToUserId == null && (x.AssignedTo == null || x.AssignedTo == ""));
            else if (Guid.TryParse(query.Assignee, out var ownerId))
                q = q.Where(x => x.AssignedToUserId == ownerId);
            else
                // Legacy leads carry only a name, so a name is still a usable selector for them.
                q = q.Where(x => x.AssignedTo == query.Assignee);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // Matches the fields the list screen shows, so a hit is always visible in a row.
            // EF.Functions.Like keeps this a SQL LIKE rather than a client-side scan.
            var term = $"%{query.Search.Trim()}%";
            q = q.Where(x =>
                EF.Functions.Like(x.FirstName, term) ||
                EF.Functions.Like(x.LastName, term) ||
                EF.Functions.Like(x.Email, term) ||
                EF.Functions.Like(x.Phone, term) ||
                (x.WhatsApp != null   && EF.Functions.Like(x.WhatsApp, term)) ||
                (x.Company != null    && EF.Functions.Like(x.Company, term)) ||
                (x.AssignedTo != null && EF.Functions.Like(x.AssignedTo, term)) ||
                EF.Functions.Like(x.Source, term));
        }

        // Counted before paging, so the footer reports the size of the whole result rather than the
        // page. One extra round trip, on an indexed predicate.
        var total = await q.CountAsync(ct);

        q = (query.SortBy, query.SortDesc) switch
        {
            ("score", true)  => q.OrderByDescending(x => x.Score).ThenByDescending(x => x.LeadDate),
            ("score", false) => q.OrderBy(x => x.Score).ThenByDescending(x => x.LeadDate),
            ("value", true)  => q.OrderByDescending(x => x.EstimatedValue).ThenByDescending(x => x.LeadDate),
            ("value", false) => q.OrderBy(x => x.EstimatedValue).ThenByDescending(x => x.LeadDate),
            (_, false)       => q.OrderBy(x => x.LeadDate).ThenBy(x => x.Id),
            // Id breaks ties: without a unique tiebreaker rows can repeat or vanish across pages
            // when many share a date, which they do here — a whole import lands on one timestamp.
            _                => q.OrderByDescending(x => x.LeadDate).ThenBy(x => x.Id),
        };

        // Projected, NOT materialised as entities. Selecting whole Leads pulls Notes, Message and
        // CustomFields off disk — on this data 5.7 MB of CustomFields and 3.5 MB of Notes across
        // ~6,000 leads, which LeadListProjection measured at 892 physical LOB reads and 41 seconds
        // of I/O against 141 ms of CPU. The mapping then threw all of it away (forList: true), so
        // the cost bought nothing. Warm and idle it still returned in ~76 ms, which is why it looked
        // fine; under startup load it went past the 30 s command timeout.
        var items = await q
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(LeadListProjection.Select)
            .ToListAsync(ct);

        // Takes the raw ConvertedDealId strings, so this stays on the light projection.
        var outcomes = await ConvertedDealOutcomes.LoadAsync(
            db, items.Select(i => i.ConvertedDealId), ct);

        var dtos = items.Select(row =>
        {
            var (stage, value) = LeadListProjection.OutcomeFor(outcomes, row);
            return LeadListProjection.ToDto(row, stage, value);
        }).ToList();

        return Result.Success(PagedResult<LeadDto>.Create(dtos, total, page, pageSize));
    }
}
