using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Commands.TopUpWallet;

public sealed record TopUpWalletCommand(Guid CustomerId, decimal Amount, string? Notes) : ICommand<CustomerDto>;

public sealed class TopUpWalletValidator : AbstractValidator<TopUpWalletCommand>
{
    public TopUpWalletValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Top-up amount must be greater than zero.");
    }
}
