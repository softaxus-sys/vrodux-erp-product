using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.Trial.Dtos;

namespace Softaxis.Identity.Application.Trial.Commands.RegisterTrial;

/// <summary>
/// Creates a new trial tenant (Cloud, 30 days) and its first admin user.
/// Requires a valid challenge token obtained from GET /api/trial/challenge.
/// </summary>
public sealed record RegisterTrialCommand(
    string?       ChallengeToken,
    string?       RemoteIp,
    string        FullName,
    string        Email,
    string        Password,
    string        OrgName,
    string?       Industry,
    string?       Country,
    string?       BusinessType,
    string?       FiscalYear,
    string?       Language,
    string?       Currency,
    string?       Timezone,
    List<string>? Modules) : ICommand<TrialRegistrationResultDto>;

public sealed class RegisterTrialValidator : AbstractValidator<RegisterTrialCommand>
{
    public RegisterTrialValidator()
    {
        RuleFor(x => x.Email).NotEmpty().WithMessage("Email is required.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password must be at least 8 characters.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain at least one digit.");

        RuleFor(x => x.OrgName).NotEmpty().WithMessage("Organisation name is required.");
    }
}
