using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Suppliers.Dtos;

namespace Softaxis.Finance.Application.Suppliers.Commands;

/// <summary>Creates a new AP supplier, optionally linked to a Chart-of-Accounts payable account.</summary>
public sealed record CreateSupplierCommand(
    string  Name,
    string? Email     = null,
    string? Phone     = null,
    string? Address   = null,
    Guid?   AccountId = null,
    bool    IsActive  = true
) : ICommand<SupplierDto>;

public sealed class CreateSupplierValidator : AbstractValidator<CreateSupplierCommand>
{
    public CreateSupplierValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Supplier name is required.")
            .MaximumLength(200).WithMessage("Supplier name must be ≤ 200 characters.");

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
