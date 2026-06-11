using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Performance.Commands;

public sealed record UpdatePerformanceGoalCommand(
    Guid   ReviewId,
    Guid   GoalId,
    int    Progress,
    string Status
) : ICommand;

public sealed class UpdatePerformanceGoalValidator : AbstractValidator<UpdatePerformanceGoalCommand>
{
    private static readonly string[] ValidStatuses = ["on_track", "at_risk", "achieved", "missed"];

    public UpdatePerformanceGoalValidator()
    {
        RuleFor(x => x.Status)
            .Must(s => ValidStatuses.Contains(s))
            .WithMessage($"Status must be one of: {string.Join(", ", ValidStatuses)}.");
    }
}
