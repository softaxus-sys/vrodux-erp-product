namespace Softaxis.Finance.Application.Banking.Dtos;

public sealed record BankAccountDto(
    Guid Id, string AccountName, string BankName, string AccountNumber, string Iban,
    string Currency, decimal Balance, decimal AvailableBalance, string Status,
    string AccountType, string LastSynced);

public sealed record BankTransactionDto(
    Guid Id, Guid AccountId, string Date, string Description, string Reference,
    decimal Amount, string Type, string Category, bool Reconciled, decimal Balance);

public sealed record BankingSummaryDto(
    decimal TotalBalance, int TotalAccounts, decimal TotalCreditThisMonth,
    decimal TotalDebitThisMonth, int Unreconciled);
