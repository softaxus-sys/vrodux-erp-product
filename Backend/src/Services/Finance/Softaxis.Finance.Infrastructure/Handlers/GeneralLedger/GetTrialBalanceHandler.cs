using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.GeneralLedger.Dtos;
using Softaxis.Finance.Application.GeneralLedger.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

internal sealed class GetTrialBalanceHandler(FinanceDbContext db) : IQueryHandler<GetTrialBalanceQuery, IReadOnlyList<TrialBalanceLineDto>>
{
    public async Task<Result<IReadOnlyList<TrialBalanceLineDto>>> Handle(GetTrialBalanceQuery query, CancellationToken ct)
    {
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.AccountNumber)
            .ToListAsync(ct);

        var lines = await db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.Status == "posted")
            .GroupBy(l => l.AccountId)
            .Select(g => new
            {
                AccountId    = g.Key,
                TotalDebits  = g.Sum(l => l.DebitAmount),
                TotalCredits = g.Sum(l => l.CreditAmount),
            })
            .ToListAsync(ct);

        var result = accounts.Select(a =>
        {
            var line    = lines.FirstOrDefault(l => l.AccountId == a.Id);
            var debits  = line?.TotalDebits  ?? 0m;
            var credits = line?.TotalCredits ?? 0m;
            return new TrialBalanceLineDto(
                a.AccountNumber, a.Name, a.AccountType,
                a.Balance,
                debits, credits,
                a.Balance + debits - credits);
        }).ToList();

        return Result.Success<IReadOnlyList<TrialBalanceLineDto>>(result);
    }
}
