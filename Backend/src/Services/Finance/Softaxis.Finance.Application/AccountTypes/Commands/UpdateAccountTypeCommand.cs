using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Lookups.Dtos;

namespace Softaxis.Finance.Application.AccountTypes.Commands;

/// <summary>Renames an account type/subtype, and (for root types only) updates its normal balance and active flag.</summary>
public sealed record UpdateAccountTypeCommand(
    Guid    Id,
    string  Name,
    string? NormalBalance = null,
    bool    IsActive      = true
) : ICommand<AccountTypeDto>;

public sealed class UpdateAccountTypeValidator : AbstractValidator<UpdateAccountTypeCommand>
{
    public UpdateAccountTypeValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Account type ID is required.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be ≤ 100 characters.");

        RuleFor(x => x.NormalBalance)
            .Must(nb => nb is "debit" or "credit")
            .When(x => x.NormalBalance is not null)
            .WithMessage("Normal balance must be 'debit' or 'credit'.");
    }
}
