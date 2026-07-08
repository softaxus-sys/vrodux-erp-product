using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.VisaServices.Application.Channels.Dtos;

namespace Softaxis.VisaServices.Application.Channels.Commands;

/// <summary>Connect / update a tenant's channel account (secret encrypted at rest).</summary>
public sealed record ConnectChannelCommand(
    string Channel, string? EstablishmentCard, string? AccountRef, string? Secret) : ICommand;

public sealed class ConnectChannelValidator : AbstractValidator<ConnectChannelCommand>
{
    public ConnectChannelValidator() { RuleFor(x => x.Channel).NotEmpty(); }
}

public sealed record DisconnectChannelCommand(string Channel) : ICommand;

public sealed record CreateSubmissionCommand(
    Guid CaseId, string Channel, string SubmissionType, string? ExternalReference,
    string? Notes, string ByName) : ICommand<GovtSubmissionDto>;

public sealed class CreateSubmissionValidator : AbstractValidator<CreateSubmissionCommand>
{
    public CreateSubmissionValidator()
    {
        RuleFor(x => x.Channel).NotEmpty();
        RuleFor(x => x.SubmissionType).NotEmpty();
    }
}

public sealed record UpdateSubmissionStatusCommand(
    Guid CaseId, Guid SubmissionId, string Status, string? ExternalReference, string? Notes, string ByName) : ICommand;
