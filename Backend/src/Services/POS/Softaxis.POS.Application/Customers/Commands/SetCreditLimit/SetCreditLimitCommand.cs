using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Commands.SetCreditLimit;

public sealed record SetCreditLimitCommand(Guid CustomerId, decimal CreditLimit) : ICommand<CustomerDto>;

public sealed class SetCreditLimitValidator : AbstractValidator<SetCreditLimitCommand>
{
    public SetCreditLimitValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.CreditLimit).GreaterThanOrEqualTo(0).WithMessage("Credit limit cannot be negative.");
    }
}
