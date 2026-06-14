using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Performance.Dtos;

namespace Softaxis.HR.Application.Performance.Commands;

public sealed record CompletePerformanceReviewCommand(
    Guid    Id,
    int?    OverallRating,
    int?    TechnicalRating,
    int?    CommunicationRating,
    int?    TeamworkRating,
    int?    LeadershipRating,
    string? Strengths,
    string? Improvements
) : ICommand<ReviewDto>;

public sealed class CompletePerformanceReviewValidator : AbstractValidator<CompletePerformanceReviewCommand>
{
    public CompletePerformanceReviewValidator()
    {
        RuleFor(x => x.OverallRating).InclusiveBetween(1, 5).When(x => x.OverallRating.HasValue);
        RuleFor(x => x.TechnicalRating).InclusiveBetween(1, 5).When(x => x.TechnicalRating.HasValue);
        RuleFor(x => x.CommunicationRating).InclusiveBetween(1, 5).When(x => x.CommunicationRating.HasValue);
        RuleFor(x => x.TeamworkRating).InclusiveBetween(1, 5).When(x => x.TeamworkRating.HasValue);
        RuleFor(x => x.LeadershipRating).InclusiveBetween(1, 5).When(x => x.LeadershipRating.HasValue);
    }
}
