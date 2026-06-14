using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Journals.Dtos;
using Softaxis.Finance.Application.Journals.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Journals;

internal sealed class GetJournalsSummaryHandler(FinanceDbContext db) : IQueryHandler<GetJournalsSummaryQuery, JournalsSummaryDto>
{
    public async Task<Result<JournalsSummaryDto>> Handle(GetJournalsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.JournalEntries.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Include(x => x.Lines)
            .Select(x => new
            {
                x.Status,
                x.Date,
                TotalDebit = x.Lines.Sum(l => l.DebitAmount),
            })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var thisMonthPrefix = $"{now:yyyy-MM}";

        return Result.Success(new JournalsSummaryDto(
            all.Count,
            all.Count(x => x.Status == "draft"),
            all.Count(x => x.Status == "posted"),
            all.Count(x => x.Status == "reversed"),
            all.Where(x => x.Status == "posted").Sum(x => x.TotalDebit),
            all.Count(x => x.Date.StartsWith(thisMonthPrefix))));
    }
}
