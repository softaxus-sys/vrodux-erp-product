using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Accounts.Dtos;
using Softaxis.Finance.Application.Accounts.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Accounts;

internal sealed class GetAccountsSummaryHandler(FinanceDbContext db)
    : IQueryHandler<GetAccountsSummaryQuery, AccountSummaryDto>
{
    public async Task<Result<AccountSummaryDto>> Handle(
        GetAccountsSummaryQuery _, CancellationToken ct)
    {
        var accounts = await db.Accounts.AsNoTracking()
            .Where(x => x.IsActive && !x.IsDeleted)
            .ToListAsync(ct);

        // Totals are built from CURRENT balances (opening + posted movements), so this summary
        // agrees with the trial balance / balance sheet instead of only reflecting opening figures.
        var movements      = await AccountBalances.LoadMovementsAsync(db, ct);
        var normalBalances = await AccountBalances.LoadNormalBalancesAsync(db, ct);

        var rows = accounts
            .GroupBy(x => x.AccountType)
            .Select(g => new
            {
                Type  = g.Key,
                Total = g.Sum(x => AccountBalances.Current(x, movements, normalBalances)),
            })
            .ToList();

        decimal Sum(string type) =>
            rows.FirstOrDefault(r => r.Type == type)?.Total ?? 0m;

        var assets      = Sum("asset");
        var liabilities = Sum("liability");
        var equity      = Sum("equity");
        var revenue     = Sum("income");
        var expenses    = Sum("expense");

        return Result.Success(new AccountSummaryDto(
            assets, liabilities, equity,
            revenue, expenses,
            NetProfit: revenue - expenses));
    }
}
