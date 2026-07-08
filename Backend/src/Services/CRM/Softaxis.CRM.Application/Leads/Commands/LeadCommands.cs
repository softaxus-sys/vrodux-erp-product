using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Leads.Dtos;

namespace Softaxis.CRM.Application.Leads.Commands;

public sealed record CreateLeadCommand(
    string FirstName, string LastName, string Title, string Company, string Industry,
    string Email, string Phone, string Country, string City, string Source, string Priority,
    decimal EstimatedValue, string AssignedTo, string? Notes,
    string? WhatsApp = null, string? InterestedIn = null, string? Budget = null, string? Message = null,
    Guid? AssignedToUserId = null)
    : ICommand<LeadDto>;

public sealed class CreateLeadValidator : AbstractValidator<CreateLeadCommand>
{
    public CreateLeadValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty();
        RuleFor(x => x.LastName).NotEmpty();
        RuleFor(x => x.Company).NotEmpty();
        RuleFor(x => x.Email).NotEmpty();
        RuleFor(x => x.Phone).NotEmpty();
    }
}

public sealed record UpdateLeadCommand(
    Guid Id, string FirstName, string LastName, string Title, string Company, string Industry,
    string Email, string Phone, string Country, string City, string Source, string Priority,
    decimal EstimatedValue, string AssignedTo, int Score, string? NextFollowUp, string? Notes,
    List<string>? Tags,
    string? WhatsApp = null, string? InterestedIn = null, string? Budget = null, string? Message = null,
    Guid? AssignedToUserId = null)
    : ICommand;

public sealed class UpdateLeadValidator : AbstractValidator<UpdateLeadCommand>
{
    public UpdateLeadValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty();
        RuleFor(x => x.LastName).NotEmpty();
        RuleFor(x => x.Company).NotEmpty();
    }
}

public sealed record UpdateLeadStatusCommand(Guid Id, string Status) : ICommand;

/// <summary>Assign or reassign a lead to a user (or clear the owner when ToUserId is null),
/// recording a handoff row in the lead's assignment history.</summary>
public sealed record AssignLeadCommand(Guid Id, Guid? ToUserId, string ToUserName, string? Note) : ICommand;

public sealed record UpdateLeadScoreCommand(Guid Id, int Score) : ICommand;

public sealed record ConvertLeadCommand(Guid Id, string? DealTitle, decimal? DealValue, string? ExpectedCloseDate)
    : ICommand<ConvertLeadResultDto>;

public sealed record DeleteLeadCommand(Guid Id) : ICommand;
