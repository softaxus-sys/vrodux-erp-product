using Softaxis.Finance.Application.Banking.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.Banking;

internal static class BankingMappings
{
    public static BankAccountDto ToDto(BankAccount x) => new(
        x.Id, x.AccountName, x.BankName, x.AccountNumber, x.Iban, x.Currency,
        x.Balance, x.AvailableBalance, x.Status, x.AccountType,
        x.LastSynced.ToString("yyyy-MM-ddTHH:mm:ssZ"));

    public static BankTransactionDto ToDto(BankTransaction x) => new(
        x.Id, x.AccountId, x.Date, x.Description, x.Reference,
        x.Amount, x.Type, x.Category, x.Reconciled, x.Balance);
}
