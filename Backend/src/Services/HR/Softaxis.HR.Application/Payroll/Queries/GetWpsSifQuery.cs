using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Payroll.Dtos;

namespace Softaxis.HR.Application.Payroll.Queries;

/// <summary>
/// Generates the WPS salary file for a payroll run.
///
/// <para>Built on the server, not in the browser, for three reasons: the employer identifiers live
/// in the database and are not shipped to the client, the file must be identical for every user
/// who exports it, and the sequence number that keeps resubmissions distinct has to be allocated
/// somewhere durable.</para>
/// </summary>
public sealed record GetWpsSifQuery(Guid RunId) : IQuery<WpsSifFileDto>;

/// <summary>The employer identifiers. Read separately so the settings screen can show them.</summary>
public sealed record GetWpsConfigurationQuery : IQuery<WpsConfigurationDto>;

public sealed record UpdateWpsConfigurationCommand(
    string EmployerUniqueId,
    string EmployerBankRoutingCode) : ICommand<WpsConfigurationDto>;

public sealed class UpdateWpsConfigurationCommandValidator : AbstractValidator<UpdateWpsConfigurationCommand>
{
    public UpdateWpsConfigurationCommandValidator()
    {
        // Length is checked rather than assumed exact: MOHRE has issued establishment numbers of
        // differing lengths over the years, so an over-strict rule would lock out real employers.
        RuleFor(x => x.EmployerUniqueId)
            .NotEmpty().WithMessage("The MOHRE establishment number is required.")
            .Must(v => v.Count(char.IsDigit) is >= 6 and <= 15)
            .WithMessage("The MOHRE establishment number should be 6–15 digits.");

        RuleFor(x => x.EmployerBankRoutingCode)
            .NotEmpty().WithMessage("The agent bank routing code is required.")
            .Must(v => v.Count(char.IsDigit) is >= 6 and <= 12)
            .WithMessage("A WPS routing code is 9 digits.");
    }
}
