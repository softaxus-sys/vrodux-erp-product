using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.JournalEntries.Dtos;
using Softaxis.Finance.Application.JournalEntries.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.JournalEntries;

internal sealed class GetJournalEntriesHandler(FinanceDbContext db) : IQueryHandler<GetJournalEntriesQuery, PagedResult<JournalEntrySummaryDto>>
{
    public async Task<Result<PagedResult<JournalEntrySummaryDto>>> Handle(GetJournalEntriesQuery query, CancellationToken ct)
    {
        IQueryable<JournalEntry> q = db.JournalEntries
            .AsNoTracking()
            .Include(x => x.Lines);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.EntryNumber.Contains(query.Search) ||
                             x.Description.Contains(query.Search) ||
                             (x.Reference != null && x.Reference.Contains(query.Search)));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.DateFrom))
            q = q.Where(x => string.Compare(x.Date, query.DateFrom) >= 0);

        if (!string.IsNullOrWhiteSpace(query.DateTo))
            q = q.Where(x => string.Compare(x.Date, query.DateTo) <= 0);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.Date)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => new JournalEntrySummaryDto(
                x.Id, x.EntryNumber, x.Date, x.Description, x.Reference, x.Status,
                x.Lines.Sum(l => l.DebitAmount),
                x.Lines.Sum(l => l.CreditAmount),
                x.Lines.Count,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<JournalEntrySummaryDto>(
            items, query.Page, query.PageSize, total, totalPages,
            query.Page < totalPages, query.Page > 1));
    }
}
