using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Application.RecurringInvoices.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringInvoices;

internal sealed class GetRecurringInvoicesHandler(FinanceDbContext db) : IQueryHandler<GetRecurringInvoicesQuery, PagedResult<RecurringDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for every template at once.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<RecurringDto>>> Handle(GetRecurringInvoicesQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is applied
        // by hand — this list previously omitted it and showed deleted templates.
        IQueryable<RecurringInvoice> q = db.RecurringInvoices.AsNoTracking()
            .Where(r => !r.IsDeleted)
            .Include(r => r.Lines);

        if (query.IsActive.HasValue)
            q = q.Where(r => r.IsActive == query.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(r => r.CustomerName.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(r => r.IsActive)
            .ThenBy(r => r.NextRunDate)
            .ThenBy(r => r.Id)              // stable: many templates share a run date
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<RecurringDto>.Create(
            items.Select(RecurringInvoiceMappings.ToDto).ToList(), total, page, pageSize));
    }
}
