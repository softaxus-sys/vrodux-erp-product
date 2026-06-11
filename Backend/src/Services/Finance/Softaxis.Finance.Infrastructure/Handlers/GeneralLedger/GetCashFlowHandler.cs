using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.GeneralLedger.Dtos;
using Softaxis.Finance.Application.GeneralLedger.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

internal sealed class GetCashFlowHandler(FinanceDbContext db) : IQueryHandler<GetCashFlowQuery, CashFlowDto>
{
    public async Task<Result<CashFlowDto>> Handle(GetCashFlowQuery query, CancellationToken ct)
    {
        var f = query.From ?? $"{DateTime.UtcNow.Year}-01-01";
        var t = query.To   ?? DateTime.UtcNow.ToString("yyyy-MM-dd");
        var (accounts, lines) = await GeneralLedgerHelpers.LoadPostedAsync(db, ct);

        var cashAccts = accounts.Where(a => a.AccountType == "asset"
            && (a.Name.Contains("cash", StringComparison.OrdinalIgnoreCase)
             || a.Name.Contains("bank", StringComparison.OrdinalIgnoreCase))).ToList();
        var cashIds = cashAccts.Select(a => a.Id).ToHashSet();

        var before   = lines.Where(l => cashIds.Contains(l.AccountId) && string.CompareOrdinal(l.Date, f) < 0);
        var inPeriod = lines.Where(l => cashIds.Contains(l.AccountId)
            && string.CompareOrdinal(l.Date, f) >= 0 && string.CompareOrdinal(l.Date, t) <= 0).ToList();

        var opening  = cashAccts.Sum(a => a.Balance) + before.Sum(l => l.Debit - l.Credit);
        var inflows  = inPeriod.Sum(l => l.Debit);
        var outflows = inPeriod.Sum(l => l.Credit);
        var net      = inflows - outflows;

        return Result.Success(new CashFlowDto(
            f, t,
            Math.Round(opening, 2),
            Math.Round(inflows, 2),
            Math.Round(outflows, 2),
            Math.Round(net, 2),
            Math.Round(opening + net, 2)));
    }
}
