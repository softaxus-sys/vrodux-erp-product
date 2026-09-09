using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Application.Customers.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class GetCrmCustomersHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetCrmCustomersQuery, PagedResult<CrmCustomerDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole account base.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<CrmCustomerDto>>> Handle(GetCrmCustomersQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // Scoped to the caller's customers tier: all / their team's / their own.
        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual.
        var q = access.ScopeCustomers(db.Customers.AsNoTracking()).Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.Tier))
            q = q.Where(x => x.Tier == query.Tier);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Name.Contains(query.Search)
                          || x.Email.Contains(query.Search)
                          || x.Industry.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        // Ordered by the SAME derived revenue the cards show, as a correlated subquery so paging
        // still happens in SQL — ordering by the stale stored column would put accounts in an order
        // the figures on screen do not explain.
        var scopedDeals = access.ScopeDeals(db.Deals.AsNoTracking());

        // The predicate is written out in full rather than routed through a helper: EF cannot see
        // inside a method call in an expression tree, so CustomerDealMetricsQuery.Linked(...) here
        // failed to translate at runtime even though it compiled.
        var items = await q
            .OrderByDescending(x => scopedDeals
                .Where(d => !d.IsDeleted
                         && d.CustomerId == x.Id
                         && d.Stage == CustomerDealMetricsQuery.WonStage)
                .Sum(d => d.ClosedValue ?? d.Value))
            .ThenBy(x => x.Id)              // stable: many accounts share a revenue figure (often 0)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        // One grouped query for the page, rather than a deals round-trip per row.
        var metrics = await CustomerDealMetricsQuery.ForAsync(scopedDeals, [.. items.Select(x => x.Id)], ct);

        return Result.Success(PagedResult<CrmCustomerDto>.Create(
            items.Select(x => CrmCustomerMappings.ToDto(x, metrics.Of(x.Id))).ToList(), total, page, pageSize));
    }
}
