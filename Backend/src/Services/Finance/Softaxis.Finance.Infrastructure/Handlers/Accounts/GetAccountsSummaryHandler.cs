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
        var rows = await db.Accounts
            .AsNoTracking()
            .Where(x => x.IsActive)
            .GroupBy(x => x.AccountType)
            .Select(g => new { Type = g.Key, Total = g.Sum(x => x.Balance) })
            .ToListAsync(ct);

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
