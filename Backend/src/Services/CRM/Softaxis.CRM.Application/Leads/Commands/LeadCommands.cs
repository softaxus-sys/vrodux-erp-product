using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Leads.Dtos;

namespace Softaxis.CRM.Application.Leads.Commands;

public sealed record CreateLeadCommand(
    string FirstName, string LastName, string Title, string Company, string Industry,
    string Email, string Phone, string Country, string City, string Source, string Priority,
    decimal EstimatedValue, string AssignedTo, string? Notes,
    string? WhatsApp = null, string? InterestedIn = null, string? Budget = null, string? Message = null,
    Guid? AssignedToUserId = null, string? PurchaseTimeframe = null, Guid? TeamId = null)
    : ICommand<LeadDto>;

public sealed class CreateLeadValidator : AbstractValidator<CreateLeadCommand>
{
    public CreateLeadValidator()
    {
        // A lead is a person we can contact. Company, surname and any one contact channel are all
        // routinely missing on real captures (a portal enquiry often arrives as a first name plus a
        // phone number), and the intake pipeline already creates such leads directly — requiring them
        // here only made a manually-entered lead stricter than an imported one.
        RuleFor(x => x.FirstName).NotEmpty();
        RuleFor(x => x)
            .Must(x => !string.IsNullOrWhiteSpace(x.Email) || !string.IsNullOrWhiteSpace(x.Phone))
            .WithName("Contact")
            .WithMessage("Enter an email address or a phone number.");
    }
}

public sealed record UpdateLeadCommand(
    Guid Id, string FirstName, string LastName, string Title, string Company, string Industry,
    string Email, string Phone, string Country, string City, string Source, string Priority,
    decimal EstimatedValue, string AssignedTo, int Score, string? NextFollowUp, string? Notes,
    List<string>? Tags,
    string? WhatsApp = null, string? InterestedIn = null, string? Budget = null, string? Message = null,
    Guid? AssignedToUserId = null, string? PurchaseTimeframe = null, Guid? TeamId = null)
    : ICommand;

public sealed class UpdateLeadValidator : AbstractValidator<UpdateLeadCommand>
{
    public UpdateLeadValidator()
    {
        // Mirrors CreateLeadValidator — see the note there.
        RuleFor(x => x.FirstName).NotEmpty();
    }
}

public sealed record UpdateLeadStatusCommand(Guid Id, string Status) : ICommand;

/// <summary>Assign or reassign a lead to a user (or clear the owner when ToUserId is null),
/// recording a handoff row in the lead's assignment history.</summary>
/// <summary>
/// Hand a lead to another user. <paramref name="TeamId"/> records WHICH TEAM the work belongs to —
/// an owner can sit in several teams, so without it every one of their team leads would see the
/// lead. Null leaves it untagged (falls back to owner membership).
/// </summary>
public sealed record AssignLeadCommand(
    Guid Id, Guid? ToUserId, string ToUserName, string? Note, Guid? TeamId = null) : ICommand;

public sealed record UpdateLeadScoreCommand(Guid Id, int Score) : ICommand;

public sealed record ConvertLeadCommand(Guid Id, string? DealTitle, decimal? DealValue, string? ExpectedCloseDate)
    : ICommand<ConvertLeadResultDto>;

public sealed record DeleteLeadCommand(Guid Id) : ICommand;

/// <summary>
/// File several leads to a team in one action. Exists because tagging existing records one at a time
/// is impractical at any real volume — and until a record is filed, a team lead cannot see it.
/// A null <paramref name="TeamId"/> un-files them (back to owner + full-access only).
/// </summary>
public sealed record BulkFileLeadsToTeamCommand(IReadOnlyList<Guid> LeadIds, Guid? TeamId)
    : ICommand<BulkFileResultDto>;

/// <summary>Outcome of a bulk filing — <paramref name="Skipped"/> counts ids the caller may not edit.</summary>
public sealed record BulkFileResultDto(int Filed, int Skipped);
