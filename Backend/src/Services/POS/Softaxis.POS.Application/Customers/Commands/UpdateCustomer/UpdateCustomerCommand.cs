using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Commands.UpdateCustomer;

public sealed record UpdateCustomerCommand(
    Guid    Id,
    string  Name,
    string? Phone,
    string? Email,
    string? Address,
    bool    IsActive,
    string? Notes) : ICommand<CustomerDto>;

public sealed class UpdateCustomerCommandValidator : AbstractValidator<UpdateCustomerCommand>
{
    public UpdateCustomerCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrEmpty(x.Email));
    }
}
