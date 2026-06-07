using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.Accounts.Commands;

/// <summary>Updates an existing chart-of-accounts entry.</summary>
public sealed record UpdateAccountCommand(
    Guid    Id,
    string  AccountNumber,
    string  Name,
    string  AccountType,
    string? Description = null,
    Guid?   ParentId    = null,
    bool    IsActive    = true
) : ICommand;

public sealed class UpdateAccountValidator : AbstractValidator<UpdateAccountCommand>
{
    private static readonly string[] ValidTypes =
        ["asset", "liability", "equity", "income", "expense"];

    public UpdateAccountValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Account ID is required.");

        RuleFor(x => x.AccountNumber)
            .NotEmpty().WithMessage("Account number is required.")
            .MaximumLength(20).WithMessage("Account number must be ≤ 20 characters.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Account name is required.")
            .MaximumLength(200).WithMessage("Account name must be ≤ 200 characters.");

        RuleFor(x => x.AccountType)
            .NotEmpty().WithMessage("Account type is required.")
            .Must(t => ValidTypes.Contains(t, StringComparer.OrdinalIgnoreCase))
                .WithMessage($"Account type must be one of: {string.Join(", ", ValidTypes)}.");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must be ≤ 500 characters.")
            .When(x => x.Description is not null);
    }
}
