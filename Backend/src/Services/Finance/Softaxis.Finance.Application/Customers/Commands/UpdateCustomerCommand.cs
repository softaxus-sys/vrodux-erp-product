using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Customers.Commands;

/// <summary>Updates an existing AR customer.</summary>
public sealed record UpdateCustomerCommand(
    Guid    Id,
    string  Name,
    string? Email     = null,
    string? Phone     = null,
    string? Address   = null,
    Guid?   AccountId = null,
    bool    IsActive  = true
) : ICommand;

public sealed class UpdateCustomerValidator : AbstractValidator<UpdateCustomerCommand>
{
    public UpdateCustomerValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Customer ID is required.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Customer name is required.")
            .MaximumLength(200).WithMessage("Customer name must be ≤ 200 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Email must be a valid email address.")
            .MaximumLength(200)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Phone)
            .MaximumLength(30).WithMessage("Phone must be ≤ 30 characters.")
            .When(x => x.Phone is not null);

        RuleFor(x => x.Address)
            .MaximumLength(500).WithMessage("Address must be ≤ 500 characters.")
            .When(x => x.Address is not null);
    }
}
