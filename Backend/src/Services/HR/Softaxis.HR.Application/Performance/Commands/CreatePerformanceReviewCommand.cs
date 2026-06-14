using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Performance.Dtos;

namespace Softaxis.HR.Application.Performance.Commands;

public sealed record CreatePerformanceReviewCommand(
    Guid   EmployeeId,
    string ReviewPeriod,
    string ReviewType,
    string DueDate,
    string ReviewedBy
) : ICommand<ReviewDto>;

public sealed class CreatePerformanceReviewValidator : AbstractValidator<CreatePerformanceReviewCommand>
{
    private static readonly string[] ValidTypes = ["annual", "mid_year", "probation", "pip"];

    public CreatePerformanceReviewValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty();

        RuleFor(x => x.ReviewType)
            .Must(t => ValidTypes.Contains(t))
            .WithMessage($"Review type must be one of: {string.Join(", ", ValidTypes)}.");

        RuleFor(x => x.ReviewPeriod).NotEmpty().WithMessage("Review period is required.");
        RuleFor(x => x.DueDate).NotEmpty().WithMessage("Due date is required.");
        RuleFor(x => x.ReviewedBy).NotEmpty().WithMessage("Reviewer is required.");
    }
}
