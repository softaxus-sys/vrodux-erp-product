namespace Softaxis.Finance.Application.GeneralLedger.Dtos;

public sealed record GlSummaryDto(
    decimal  TotalDebits,
    decimal  TotalCredits,
    bool     IsBalanced,
    string[] Periods,
    int      Accounts,
    string   CurrentPeriod);

public sealed record TrialBalanceLineDto(
    Guid    AccountId,
    string  AccountCode,
    string  AccountName,
    string  AccountType,
    decimal OpeningBalance,
    decimal TotalDebits,
    decimal TotalCredits,
    decimal ClosingBalance);

public sealed record StatementLineDto(string AccountCode, string AccountName, decimal Amount);

public sealed record ProfitLossDto(
    string From,
    string To,
    IReadOnlyList<StatementLineDto> Revenue,
    decimal TotalRevenue,
    IReadOnlyList<StatementLineDto> Expenses,
    decimal TotalExpenses,
    decimal NetProfit);

public sealed record BalanceSheetDto(
    string AsOf,
    IReadOnlyList<StatementLineDto> Assets,
    decimal TotalAssets,
    IReadOnlyList<StatementLineDto> Liabilities,
    decimal TotalLiabilities,
    IReadOnlyList<StatementLineDto> Equity,
    decimal RetainedEarnings,
    decimal TotalEquity,
    decimal TotalLiabilitiesAndEquity,
    bool IsBalanced);

public sealed record AccountLedgerEntryDto(
    string  Date,
    string  EntryNumber,
    string? Reference,
    string  Description,
    decimal Debit,
    decimal Credit,
    decimal RunningBalance);

public sealed record AccountLedgerDto(
    Guid    AccountId,
    string  AccountCode,
    string  AccountName,
    string  AccountType,
    string? From,
    string? To,
    decimal OpeningBalance,
    IReadOnlyList<AccountLedgerEntryDto> Entries,
    decimal TotalDebits,
    decimal TotalCredits,
    decimal ClosingBalance);

public sealed record CashFlowDto(
    string  From,
    string  To,
    decimal OpeningCash,
    decimal Inflows,
    decimal Outflows,
    decimal NetCashFlow,
    decimal ClosingCash);
