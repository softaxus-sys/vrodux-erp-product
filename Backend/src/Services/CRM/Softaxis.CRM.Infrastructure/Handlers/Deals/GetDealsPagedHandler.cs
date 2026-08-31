using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Application.Deals.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class GetDealsPagedHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetDealsPagedQuery, PagedResult<DealDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole pipeline back.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<DealDto>>> Handle(GetDealsPagedQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // Scoped to the caller's pipeline tier: all / their team's / their own.
        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual.
        var q = access.ScopeDeals(db.Deals.AsNoTracking()).Where(x => !x.IsDeleted);

        if (query.CustomerId.HasValue)
            q = q.Where(x => x.CustomerId == query.CustomerId);

        if (!string.IsNullOrWhiteSpace(query.Stage))
            q = q.Where(x => x.Stage == query.Stage);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Title.Contains(query.Search) || x.Company.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.Value)
            .ThenBy(x => x.Id)              // stable: many deals share a value
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<DealDto>.Create(
            items.Select(DealMappings.ToDto).ToList(), total, page, pageSize));
    }
}
