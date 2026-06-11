using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Banking.Dtos;
using Softaxis.Finance.Application.Banking.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal sealed class GetBankingSummaryHandler(FinanceDbContext db) : IQueryHandler<GetBankingSummaryQuery, BankingSummaryDto>
{
    public async Task<Result<BankingSummaryDto>> Handle(GetBankingSummaryQuery query, CancellationToken ct)
    {
        var accounts = await db.BankAccounts.AsNoTracking()
            .Where(x => !x.IsDeleted && x.Status == "active")
            .Select(x => new { x.Balance }).ToListAsync(ct);

        var now = DateTime.UtcNow;
        var monthStart = $"{now:yyyy-MM-01}";

        var txStats = await db.BankTransactions.AsNoTracking()
            .Where(x => string.Compare(x.Date, monthStart) >= 0)
            .GroupBy(x => x.Type)
            .Select(g => new { Type = g.Key, Total = g.Sum(t => t.Amount) })
            .ToListAsync(ct);

        var unreconciled = await db.BankTransactions.AsNoTracking()
            .Where(x => !x.Reconciled).CountAsync(ct);

        return Result.Success(new BankingSummaryDto(
            accounts.Sum(a => a.Balance),
            accounts.Count,
            txStats.FirstOrDefault(t => t.Type == "credit")?.Total ?? 0m,
            txStats.FirstOrDefault(t => t.Type == "debit")?.Total ?? 0m,
            unreconciled));
    }
}
