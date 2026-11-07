using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Identity.Application.Trial.Dtos;

namespace Softaxis.Identity.Application.Trial.Commands.RegisterTrial;

/// <summary>
/// Creates a new trial tenant (Cloud, 14-day trial) and its first admin user.
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
    List<string>? Modules,
    // ── Pricing-page attribution (erp.vrodux.com/trial?plan=&billing=&intent=&utm_source=) ──
    // All optional and trailing: a direct signup with no query string still works unchanged.
    string?       Plan          = null,   // "micro" | "starter" | "professional" (enterprise = sales-led)
    string?       Billing       = null,   // "monthly" | "annual"
    string?       Intent        = null,   // "trial" | "buy"
    string?       UtmSource     = null,
    // ── Ad-conversion de-duplication (browser Pixel ↔ server Conversions API) ──
    string?       EventId       = null,
    string?       Fbp           = null,
    string?       Fbc           = null,
    string?       UserAgent     = null,
    string?       SourceUrl     = null,
    // Phone or WhatsApp — required (see the validator); the sales team calls it when a trial goes quiet.
    string?       Phone         = null) : ICommand<TrialRegistrationResultDto>;

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

        // Digits only are counted, so "+971 (50) 123-4567" and "00971501234567" both pass; letters do not.
        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("A phone or WhatsApp number is required.")
            .Must(p => p is null || (p.Trim().Length <= 30 && System.Text.RegularExpressions.Regex.IsMatch(p.Trim(), @"^[+\d\s().-]+$")
                        && p.Count(char.IsDigit) is >= 7 and <= 15))
            .WithMessage("Enter a valid phone or WhatsApp number (7 to 15 digits).");
    }
}
