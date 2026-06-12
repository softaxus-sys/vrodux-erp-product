using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Suppliers.Commands;

/// <summary>Updates an existing AP supplier.</summary>
public sealed record UpdateSupplierCommand(
    Guid    Id,
    string  Name,
    string? Email     = null,
    string? Phone     = null,
    string? Address   = null,
    Guid?   AccountId = null,
    bool    IsActive  = true
) : ICommand;

public sealed class UpdateSupplierValidator : AbstractValidator<UpdateSupplierCommand>
{
    public UpdateSupplierValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Supplier ID is required.");

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
