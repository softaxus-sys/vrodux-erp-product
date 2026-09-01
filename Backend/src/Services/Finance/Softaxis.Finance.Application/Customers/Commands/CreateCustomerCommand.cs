using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Customers.Dtos;

namespace Softaxis.Finance.Application.Customers.Commands;

/// <summary>Creates a new AR customer, optionally linked to a Chart-of-Accounts receivable account.</summary>
public sealed record CreateCustomerCommand(
    string  Name,
    string? Email     = null,
    string? Phone     = null,
    string? Address   = null,
    Guid?   AccountId = null,
    /// <summary>Their people to copy on invoices and receipts. Comma or semicolon separated.</summary>
    string? CcEmails  = null,
    bool    IsActive  = true
) : ICommand<CustomerDto>;

public sealed class CreateCustomerValidator : AbstractValidator<CreateCustomerCommand>
{
    public CreateCustomerValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Customer name is required.")
            .MaximumLength(200).WithMessage("Customer name must be ≤ 200 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Email must be a valid email address.")
            .MaximumLength(200)
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.CcEmails)
            .MaximumLength(2000).WithMessage("CC list must be ≤ 2000 characters.");

        RuleFor(x => x.Phone)
            .MaximumLength(30).WithMessage("Phone must be ≤ 30 characters.")
            .When(x => x.Phone is not null);

        RuleFor(x => x.Address)
            .MaximumLength(500).WithMessage("Address must be ≤ 500 characters.")
            .When(x => x.Address is not null);
    }
}
