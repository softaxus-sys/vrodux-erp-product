using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Journals.Dtos;
using Softaxis.Finance.Application.Journals.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Journals;

internal sealed class GetJournalsHandler(FinanceDbContext db) : IQueryHandler<GetJournalsQuery, PagedResult<JournalDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole ledger back.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<JournalDto>>> Handle(GetJournalsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        IQueryable<JournalEntry> q = db.JournalEntries.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(l => l.Account)
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.EntryNumber.Contains(query.Search) || x.Description.Contains(query.Search));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        // Period is the yyyy-MM prefix of the stored date, so a prefix match is the filter.
        // This was done in the browser over the whole list, against a HARDCODED period list that
        // stopped at 2026-05 — stale for months before anyone noticed.
        if (!string.IsNullOrWhiteSpace(query.Period))
            q = q.Where(x => x.Date.StartsWith(query.Period));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.CreatedAt)   // stable: many entries share one date
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<JournalDto>.Create(
            items.Select(JournalMappings.ToDto).ToList(), total, page, pageSize));
    }
}
