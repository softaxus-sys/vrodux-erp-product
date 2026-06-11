using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Journals.Dtos;
using Softaxis.Finance.Application.Journals.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Journals;

internal sealed class GetJournalsHandler(FinanceDbContext db) : IQueryHandler<GetJournalsQuery, IReadOnlyList<JournalDto>>
{
    public async Task<Result<IReadOnlyList<JournalDto>>> Handle(GetJournalsQuery query, CancellationToken ct)
    {
        IQueryable<JournalEntry> q = db.JournalEntries.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(l => l.Account)
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.EntryNumber.Contains(query.Search) || x.Description.Contains(query.Search));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        var items = await q
            .OrderByDescending(x => x.Date)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<JournalDto>>(items.Select(JournalMappings.ToDto).ToList());
    }
}
