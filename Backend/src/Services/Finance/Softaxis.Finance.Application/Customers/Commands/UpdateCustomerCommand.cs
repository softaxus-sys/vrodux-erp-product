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
    /// <summary>Their people to copy on invoices and receipts. Comma or semicolon separated.</summary>
    string? CcEmails  = null,
    bool    IsActive  = true,
    /// <summary>Tax registration number — a UAE TRN is 15 digits starting with 100.</summary>
    string? Trn         = null,
    /// <summary>Emirate code (AUH, DXB, SHJ, AJM, UAQ, RAK, FUJ).</summary>
    string? Emirate     = null,
    string? City        = null,
    /// <summary>ISO 3166-1 alpha-2, e.g. AE.</summary>
    string? CountryCode = null,
    /// <summary>Peppol participant ID for e-invoicing.</summary>
    string? PeppolId    = null) : ICommand;

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

        CustomerTaxRules.Apply(this, x => x.Trn, x => x.Emirate, x => x.CountryCode, x => x.City, x => x.PeppolId);

        RuleFor(x => x.Address)
            .MaximumLength(500).WithMessage("Address must be ≤ 500 characters.")
            .When(x => x.Address is not null);
    }
}
