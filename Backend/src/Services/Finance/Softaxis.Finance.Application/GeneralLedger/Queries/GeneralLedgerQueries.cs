using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.GeneralLedger.Dtos;

namespace Softaxis.Finance.Application.GeneralLedger.Queries;

public sealed record GetGlSummaryQuery : IQuery<GlSummaryDto>;

public sealed record GetTrialBalanceQuery : IQuery<IReadOnlyList<TrialBalanceLineDto>>;

public sealed record GetProfitLossQuery(string? From, string? To) : IQuery<ProfitLossDto>;

public sealed record GetBalanceSheetQuery(string? AsOf) : IQuery<BalanceSheetDto>;

public sealed record GetCashFlowQuery(string? From, string? To) : IQuery<CashFlowDto>;

public sealed record GetAccountLedgerQuery(Guid AccountId, string? From, string? To) : IQuery<AccountLedgerDto>;
