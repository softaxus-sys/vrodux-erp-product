using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.LeadIntake.Commands;

/// <summary>
/// The single internal pipeline entry point (POST /api/internal/leads). Every in-app caller
/// pushes a canonical lead here; it flows through mapping → dedupe → create → routing →
/// notification. Tenant is taken from the authenticated context.
/// </summary>
public sealed record IngestLeadCommand(IngestLeadInput Lead) : ICommand<IngestLeadResult>;

/// <summary>Flat canonical-lead payload accepted by the internal endpoint.</summary>
public sealed record IngestLeadInput(
    string? FirstName, string? LastName, string? FullName, string? Email, string? Phone,
    string? Company, string? Title, string? Industry, string? Address, string? City,
    string? Country, string? Notes, string? Source, string? Campaign,
    Dictionary<string, string?>? Fields,
    string? WhatsApp = null, string? InterestedIn = null, string? Budget = null,
    string? Message = null, string? FormName = null);

public sealed record IngestLeadResult(string Outcome, Guid? LeadId, string? Message);

public sealed class IngestLeadValidator : AbstractValidator<IngestLeadCommand>
{
    public IngestLeadValidator()
    {
        RuleFor(x => x.Lead).NotNull();
        RuleFor(x => x.Lead).Must(l =>
                !string.IsNullOrWhiteSpace(l.Email) || !string.IsNullOrWhiteSpace(l.Phone)
             || !string.IsNullOrWhiteSpace(l.FullName) || !string.IsNullOrWhiteSpace(l.FirstName))
            .WithMessage("Lead must include at least an email, phone, or name.");
    }
}
