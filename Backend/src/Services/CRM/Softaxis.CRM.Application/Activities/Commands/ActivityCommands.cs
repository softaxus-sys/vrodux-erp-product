using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Application.Activities.Commands;

public sealed record CreateActivityCommand(
    string Type, string Subject, string? Description, string RelatedToType, Guid RelatedToId,
    string? RelatedToName, string? DueDate, string AssignedTo,
    Guid? AssignedToUserId = null, string? DueTime = null) : ICommand<ActivityDto>;

public sealed class CreateActivityValidator : AbstractValidator<CreateActivityCommand>
{
    public CreateActivityValidator()
    {
        RuleFor(x => x.Type).NotEmpty();
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(Activity.SubjectMaxLength)
            .WithMessage($"Text is too long — the limit is {Activity.SubjectMaxLength:N0} characters.");
        RuleFor(x => x.RelatedToType).NotEmpty();
        RuleFor(x => x.AssignedTo).NotEmpty();
        RuleFor(x => x.DueTime).Matches(ActivityRules.TimePattern).When(x => !string.IsNullOrWhiteSpace(x.DueTime))
            .WithMessage("Time must be in HH:mm format.");
    }
}

public sealed class UpdateActivityValidator : AbstractValidator<UpdateActivityCommand>
{
    public UpdateActivityValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(Activity.SubjectMaxLength)
            .WithMessage($"Text is too long — the limit is {Activity.SubjectMaxLength:N0} characters.");
        RuleFor(x => x.DueTime).Matches(ActivityRules.TimePattern).When(x => !string.IsNullOrWhiteSpace(x.DueTime))
            .WithMessage("Time must be in HH:mm format.");
    }
}

internal static class ActivityRules
{
    /// <summary>24-hour HH:mm.</summary>
    public const string TimePattern = @"^([01]\d|2[0-3]):[0-5]\d$";
}

public sealed record UpdateActivityCommand(
    Guid Id, string Type, string Subject, string? Description, string? DueDate, string AssignedTo,
    Guid? AssignedToUserId = null, string? DueTime = null) : ICommand;

public sealed record CompleteActivityCommand(Guid Id) : ICommand;

public sealed record ReopenActivityCommand(Guid Id) : ICommand;

public sealed record DeleteActivityCommand(Guid Id) : ICommand;
