using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Banking.Commands;

public sealed record CreateBankAccountCommand(
    string AccountName, string BankName, string AccountNumber,
    string Iban, string Currency, string AccountType) : ICommand<Guid>;

public sealed class CreateBankAccountValidator : AbstractValidator<CreateBankAccountCommand>
{
    public CreateBankAccountValidator()
    {
        RuleFor(x => x.AccountName).NotEmpty();
        RuleFor(x => x.BankName).NotEmpty();
        RuleFor(x => x.AccountNumber).NotEmpty();
        RuleFor(x => x.Iban).NotEmpty();
        RuleFor(x => x.Currency).NotEmpty();
    }
}

/// <summary>
/// Records a manual bank transaction (inflow / outflow / transfer).
/// For transfers, pass ToAccountId — two transactions are created and both balances updated.
/// </summary>
public sealed record CreateBankTransactionCommand(
    Guid AccountId, string Date, string Description, string Type, string Category,
    decimal Amount, string? Reference = null, Guid? ToAccountId = null) : ICommand<Guid>;

public sealed class CreateBankTransactionValidator : AbstractValidator<CreateBankTransactionCommand>
{
    public CreateBankTransactionValidator()
    {
        RuleFor(x => x.Date).NotEmpty();
        RuleFor(x => x.Description).NotEmpty();
        RuleFor(x => x.Category).NotEmpty();
        RuleFor(x => x.Type.ToLowerInvariant())
            .Must(t => t is "credit" or "debit")
            .WithMessage("Type must be 'credit' or 'debit'.");
    }
}

public sealed record ReconcileBankTransactionCommand(Guid Id) : ICommand;
