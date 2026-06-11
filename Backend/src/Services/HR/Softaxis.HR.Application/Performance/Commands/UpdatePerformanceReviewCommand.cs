using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.HR.Application.Performance.Commands;

public sealed record UpdatePerformanceReviewCommand(
    Guid   Id,
    string ReviewPeriod,
    string ReviewType,
    string DueDate,
    string ReviewedBy
) : ICommand;

public sealed class UpdatePerformanceReviewValidator : AbstractValidator<UpdatePerformanceReviewCommand>
{
    private static readonly string[] ValidTypes = ["annual", "mid_year", "probation", "pip"];

    public UpdatePerformanceReviewValidator()
    {
        RuleFor(x => x.ReviewType)
            .Must(t => ValidTypes.Contains(t))
            .WithMessage($"Review type must be one of: {string.Join(", ", ValidTypes)}.");

        RuleFor(x => x.ReviewPeriod).NotEmpty().WithMessage("Review period is required.");
        RuleFor(x => x.DueDate).NotEmpty().WithMessage("Due date is required.");
        RuleFor(x => x.ReviewedBy).NotEmpty().WithMessage("Reviewer is required.");
    }
}
