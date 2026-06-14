using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Accounts.Dtos;

namespace Softaxis.Finance.Application.Accounts.Commands;

/// <summary>Creates a new chart-of-accounts entry.</summary>
public sealed record CreateAccountCommand(
    string  AccountNumber,
    string  Name,
    Guid    AccountTypeId,
    string? Description = null,
    Guid?   ParentId    = null,
    bool    IsActive    = true
) : ICommand<AccountDto>;

public sealed class CreateAccountValidator : AbstractValidator<CreateAccountCommand>
{
    public CreateAccountValidator()
    {
        RuleFor(x => x.AccountNumber)
            .NotEmpty().WithMessage("Account number is required.")
            .MaximumLength(20).WithMessage("Account number must be ≤ 20 characters.")
            .Matches(@"^[A-Za-z0-9][A-Za-z0-9\-\.]{0,19}$")
                .WithMessage("Account number may only contain letters, digits, hyphens and dots (e.g. 1001, 1001-A, ACC-01).");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Account name is required.")
            .MaximumLength(200).WithMessage("Account name must be ≤ 200 characters.");

        RuleFor(x => x.AccountTypeId)
            .NotEmpty().WithMessage("Account type is required.");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must be ≤ 500 characters.")
            .When(x => x.Description is not null);
    }
}
