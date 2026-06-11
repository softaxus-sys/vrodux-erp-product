using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.GeneralLedger.Dtos;
using Softaxis.Finance.Application.GeneralLedger.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

internal sealed class GetGlSummaryHandler(FinanceDbContext db) : IQueryHandler<GetGlSummaryQuery, GlSummaryDto>
{
    public async Task<Result<GlSummaryDto>> Handle(GetGlSummaryQuery query, CancellationToken ct)
    {
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => !x.IsDeleted).CountAsync(ct);

        var lines = await db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.Status == "posted")
            .Select(l => new { l.DebitAmount, l.CreditAmount })
            .ToListAsync(ct);

        var totalDebits  = lines.Sum(l => l.DebitAmount);
        var totalCredits = lines.Sum(l => l.CreditAmount);

        return Result.Success(new GlSummaryDto(
            totalDebits,
            totalCredits,
            Math.Abs(totalDebits - totalCredits) < 0.01m,
            new[] { "2026-01", "2026-02", "2026-03", "2026-04", "2026-05" },
            accounts,
            $"{DateTime.UtcNow:yyyy-MM}"));
    }
}
