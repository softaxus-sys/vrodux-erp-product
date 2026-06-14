using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Lookups.Dtos;

namespace Softaxis.Finance.Application.AccountTypes.Commands;

/// <summary>Creates a new account type (root type, when ParentId is null) or subtype (when ParentId is set).</summary>
public sealed record CreateAccountTypeCommand(
    string  Name,
    string? NormalBalance = null,
    Guid?   ParentId      = null
) : ICommand<AccountTypeDto>;

public sealed class CreateAccountTypeValidator : AbstractValidator<CreateAccountTypeCommand>
{
    public CreateAccountTypeValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be ≤ 100 characters.");

        RuleFor(x => x.NormalBalance)
            .Must(nb => nb is "debit" or "credit")
            .When(x => x.ParentId is null)
            .WithMessage("Normal balance must be 'debit' or 'credit'.");
    }
}
