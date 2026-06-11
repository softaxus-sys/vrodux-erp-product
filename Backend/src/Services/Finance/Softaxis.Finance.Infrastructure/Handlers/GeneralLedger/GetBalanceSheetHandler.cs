using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.GeneralLedger.Dtos;
using Softaxis.Finance.Application.GeneralLedger.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

internal sealed class GetBalanceSheetHandler(FinanceDbContext db) : IQueryHandler<GetBalanceSheetQuery, BalanceSheetDto>
{
    public async Task<Result<BalanceSheetDto>> Handle(GetBalanceSheetQuery query, CancellationToken ct)
    {
        var d = query.AsOf ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
        var (accounts, lines) = await GeneralLedgerHelpers.LoadPostedAsync(db, ct);
        var upto = lines.Where(l => string.CompareOrdinal(l.Date, d) <= 0).ToList();

        decimal Movement(Guid id, bool debitNormal)
        {
            var ls = upto.Where(l => l.AccountId == id);
            return debitNormal ? ls.Sum(l => l.Debit - l.Credit) : ls.Sum(l => l.Credit - l.Debit);
        }

        StatementLineDto? Line(Account a, bool debitNormal)
        {
            var amount = a.Balance + Movement(a.Id, debitNormal);
            return amount == 0 ? null : new StatementLineDto(a.AccountNumber, a.Name, Math.Round(amount, 2));
        }

        var assets      = accounts.Where(a => a.AccountType == "asset").Select(a => Line(a, true)).Where(x => x != null).Cast<StatementLineDto>().ToList();
        var liabilities = accounts.Where(a => a.AccountType == "liability").Select(a => Line(a, false)).Where(x => x != null).Cast<StatementLineDto>().ToList();
        var equity      = accounts.Where(a => a.AccountType == "equity").Select(a => Line(a, false)).Where(x => x != null).Cast<StatementLineDto>().ToList();

        var retained = accounts.Where(a => a.AccountType == "income").Sum(a => Movement(a.Id, false))
                     - accounts.Where(a => a.AccountType == "expense").Sum(a => Movement(a.Id, true));
        retained = Math.Round(retained, 2);

        var totalAssets = assets.Sum(x => x.Amount);
        var totalLiab   = liabilities.Sum(x => x.Amount);
        var totalEquity = equity.Sum(x => x.Amount) + retained;
        var totalLiabEq = totalLiab + totalEquity;

        return Result.Success(new BalanceSheetDto(
            d, assets, totalAssets, liabilities, totalLiab,
            equity, retained, totalEquity, totalLiabEq,
            Math.Abs(totalAssets - totalLiabEq) < 0.01m));
    }
}
