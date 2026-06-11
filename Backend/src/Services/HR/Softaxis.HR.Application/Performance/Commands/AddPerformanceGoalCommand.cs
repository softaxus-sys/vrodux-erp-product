using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Performance.Dtos;

namespace Softaxis.HR.Application.Performance.Commands;

public sealed record AddPerformanceGoalCommand(
    Guid   ReviewId,
    string Title,
    string Target,
    string DueDate
) : ICommand<ReviewDto>;

public sealed class AddPerformanceGoalValidator : AbstractValidator<AddPerformanceGoalCommand>
{
    public AddPerformanceGoalValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Goal title is required.");
        RuleFor(x => x.Target).NotEmpty().WithMessage("Goal target is required.");
        RuleFor(x => x.DueDate).NotEmpty().WithMessage("Due date is required.");
    }
}
