using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Application.Performance.Dtos;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class CompletePerformanceReviewHandler(HrDbContext db)
    : ICommandHandler<CompletePerformanceReviewCommand, ReviewDto>
{
    public async Task<Result<ReviewDto>> Handle(CompletePerformanceReviewCommand cmd, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.Include(x => x.Goals).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (review is null)
            return Result.Failure<ReviewDto>(Error.NotFoundById("PerformanceReview", cmd.Id));

        if (review.Status == "completed")
            return Result.Failure<ReviewDto>(Error.Custom("PerformanceReview.AlreadyCompleted", "Review is already completed."));

        review.Complete(cmd.OverallRating, cmd.TechnicalRating, cmd.CommunicationRating, cmd.TeamworkRating, cmd.LeadershipRating, cmd.Strengths, cmd.Improvements);
        await db.SaveChangesAsync(ct);

        return Result.Success(PerformanceMappings.ToDto(review));
    }
}
