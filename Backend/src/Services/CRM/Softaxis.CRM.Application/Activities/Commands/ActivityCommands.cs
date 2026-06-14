using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Activities.Dtos;

namespace Softaxis.CRM.Application.Activities.Commands;

public sealed record CreateActivityCommand(
    string Type, string Subject, string? Description, string RelatedToType, Guid RelatedToId,
    string? RelatedToName, string? DueDate, string AssignedTo) : ICommand<ActivityDto>;

public sealed class CreateActivityValidator : AbstractValidator<CreateActivityCommand>
{
    public CreateActivityValidator()
    {
        RuleFor(x => x.Type).NotEmpty();
        RuleFor(x => x.Subject).NotEmpty();
        RuleFor(x => x.RelatedToType).NotEmpty();
        RuleFor(x => x.AssignedTo).NotEmpty();
    }
}

public sealed record UpdateActivityCommand(
    Guid Id, string Type, string Subject, string? Description, string? DueDate, string AssignedTo) : ICommand;

public sealed record CompleteActivityCommand(Guid Id) : ICommand;

public sealed record ReopenActivityCommand(Guid Id) : ICommand;

public sealed record DeleteActivityCommand(Guid Id) : ICommand;
