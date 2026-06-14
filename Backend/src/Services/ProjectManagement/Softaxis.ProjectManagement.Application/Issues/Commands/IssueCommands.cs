using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.ProjectManagement.Application.Issues.Dtos;

namespace Softaxis.ProjectManagement.Application.Issues.Commands;

public static class IssueConstants
{
    public static readonly string[] Types = ["epic", "story", "task", "bug"];
    public static readonly string[] Priorities = ["lowest", "low", "medium", "high", "highest"];
}

public sealed record CreateIssueCommand(
    Guid ProjectId, string Title, string ReporterName, string? Description = null,
    string Type = "task", string Priority = "medium", Guid? BoardColumnId = null,
    Guid? AssigneeId = null, string? AssigneeName = null, Guid? EpicId = null, Guid? SprintId = null,
    decimal? StoryPoints = null, string? DueDate = null, IReadOnlyList<Guid>? LabelIds = null) : ICommand<IssueDto>;

public sealed class CreateIssueValidator : AbstractValidator<CreateIssueCommand>
{
    public CreateIssueValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.ReporterName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(10000);
        RuleFor(x => x.Type).Must(IssueConstants.Types.Contains)
            .WithMessage($"Type must be one of: {string.Join(", ", IssueConstants.Types)}");
        RuleFor(x => x.Priority).Must(IssueConstants.Priorities.Contains)
            .WithMessage($"Priority must be one of: {string.Join(", ", IssueConstants.Priorities)}");
    }
}

public sealed record UpdateIssueCommand(
    Guid Id, string Title, string? Description, string Type, string Priority,
    Guid? AssigneeId, string? AssigneeName, Guid? EpicId,
    decimal? StoryPoints, string? DueDate, IReadOnlyList<Guid>? LabelIds = null) : ICommand<IssueDto>;

public sealed class UpdateIssueValidator : AbstractValidator<UpdateIssueCommand>
{
    public UpdateIssueValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Description).MaximumLength(10000);
        RuleFor(x => x.Type).Must(IssueConstants.Types.Contains)
            .WithMessage($"Type must be one of: {string.Join(", ", IssueConstants.Types)}");
        RuleFor(x => x.Priority).Must(IssueConstants.Priorities.Contains)
            .WithMessage($"Priority must be one of: {string.Join(", ", IssueConstants.Priorities)}");
    }
}

public sealed record MoveIssueCommand(Guid Id, Guid BoardColumnId, int SortOrder) : ICommand<IssueDto>;

public sealed record MoveIssueToSprintCommand(Guid Id, Guid? SprintId, int SortOrder) : ICommand<IssueDto>;

public sealed record DeleteIssueCommand(Guid Id) : ICommand;
