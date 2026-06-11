using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.GeneralLedger.Dtos;
using Softaxis.Finance.Application.GeneralLedger.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

internal sealed class GetProfitLossHandler(FinanceDbContext db) : IQueryHandler<GetProfitLossQuery, ProfitLossDto>
{
    public async Task<Result<ProfitLossDto>> Handle(GetProfitLossQuery query, CancellationToken ct)
    {
        var f = query.From ?? $"{DateTime.UtcNow.Year}-01-01";
        var t = query.To   ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
        var (accounts, lines) = await GeneralLedgerHelpers.LoadPostedAsync(db, ct);
        var inPeriod = lines.Where(l => string.CompareOrdinal(l.Date, f) >= 0 && string.CompareOrdinal(l.Date, t) <= 0).ToList();

        StatementLineDto? Line(Account a, bool creditNormal)
        {
            var ls = inPeriod.Where(l => l.AccountId == a.Id);
            var amount = creditNormal ? ls.Sum(l => l.Credit - l.Debit) : ls.Sum(l => l.Debit - l.Credit);
            return amount == 0 ? null : new StatementLineDto(a.AccountNumber, a.Name, Math.Round(amount, 2));
        }

        var revenue  = accounts.Where(a => a.AccountType == "income").Select(a => Line(a, true)).Where(x => x != null).Cast<StatementLineDto>().ToList();
        var expenses = accounts.Where(a => a.AccountType == "expense").Select(a => Line(a, false)).Where(x => x != null).Cast<StatementLineDto>().ToList();
        var totalRevenue  = revenue.Sum(x => x.Amount);
        var totalExpenses = expenses.Sum(x => x.Amount);

        return Result.Success(new ProfitLossDto(
            f, t, revenue, totalRevenue, expenses, totalExpenses,
            Math.Round(totalRevenue - totalExpenses, 2)));
    }
}
