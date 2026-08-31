using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Application.Activities.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class GetActivitiesPagedHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetActivitiesPagedQuery, PagedResult<ActivityDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole table and reintroduce
    /// exactly the response this query exists to avoid.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<ActivityDto>>> Handle(GetActivitiesPagedQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // Access scope first: everything below only narrows what the caller may already see.
        // Assigned-only users see activities on the leads they own; full-view users see all.
        var q = access.ScopeActivities(db.Activities.AsNoTracking());

        if (!string.IsNullOrWhiteSpace(query.RelatedToType)) q = q.Where(a => a.RelatedToType == query.RelatedToType);
        if (query.RelatedToId.HasValue)                      q = q.Where(a => a.RelatedToId == query.RelatedToId.Value);
        if (query.Completed.HasValue)                        q = q.Where(a => a.Completed == query.Completed.Value);
        if (!string.IsNullOrWhiteSpace(query.Type))          q = q.Where(a => a.Type == query.Type);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // Matches the fields the row shows, so a hit is always visible in the result.
            // EF.Functions.Like keeps it a SQL LIKE rather than a client-side scan.
            var term = $"%{query.Search.Trim()}%";
            q = q.Where(a =>
                EF.Functions.Like(a.Subject, term) ||
                (a.Description != null && EF.Functions.Like(a.Description, term)) ||
                (a.RelatedToName != null && EF.Functions.Like(a.RelatedToName, term)));
        }

        // Dates are stored as yyyy-MM-dd strings, which compare correctly with string.Compare.
        if (!string.IsNullOrWhiteSpace(query.DueBefore))
            q = q.Where(a => a.DueDate != null && string.Compare(a.DueDate, query.DueBefore) < 0);

        if (!string.IsNullOrWhiteSpace(query.DueOn))
            q = q.Where(a => a.DueDate == query.DueOn);

        // Counted before paging, so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            // Open first, then soonest due — the order someone actually works the list in.
            // Nulls last: an activity with no due date is not more urgent than one due today.
            .OrderBy(a => a.Completed)
            .ThenBy(a => a.DueDate == null)
            .ThenBy(a => a.DueDate)
            .ThenByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<ActivityDto>.Create(
            items.Select(ActivityMappings.ToDto).ToList(), total, page, pageSize));
    }
}
