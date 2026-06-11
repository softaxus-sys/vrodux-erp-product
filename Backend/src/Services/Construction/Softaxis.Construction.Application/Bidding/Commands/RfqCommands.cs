using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Bidding.Dtos;

namespace Softaxis.Construction.Application.Bidding.Commands;

public sealed record CreateRfqCommand(
    Guid? LeadId, Guid? CustomerId, string ClientName, string ProjectTitle, string? Scope,
    decimal? Budget, string DueDate, string? AssignedTo, string? Notes) : ICommand<RfqDto>;

public sealed class CreateRfqValidator : AbstractValidator<CreateRfqCommand>
{
    public CreateRfqValidator()
    {
        RuleFor(x => x.ClientName).NotEmpty();
        RuleFor(x => x.ProjectTitle).NotEmpty();
        RuleFor(x => x.DueDate).NotEmpty();
    }
}

public sealed record SetRfqStatusCommand(Guid Id, string Status) : ICommand;

public sealed class SetRfqStatusValidator : AbstractValidator<SetRfqStatusCommand>
{
    public SetRfqStatusValidator()
    {
        RuleFor(x => x.Status).NotEmpty();
    }
}

public sealed record DeleteRfqCommand(Guid Id) : ICommand;
