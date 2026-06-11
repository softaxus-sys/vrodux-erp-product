using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Application.Performance.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class AddPerformanceGoalHandler(HrDbContext db)
    : ICommandHandler<AddPerformanceGoalCommand, ReviewDto>
{
    public async Task<Result<ReviewDto>> Handle(AddPerformanceGoalCommand cmd, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.Include(x => x.Goals).FirstOrDefaultAsync(x => x.Id == cmd.ReviewId, ct);
        if (review is null)
            return Result.Failure<ReviewDto>(Error.NotFoundById("PerformanceReview", cmd.ReviewId));

        var goal = new PerformanceGoal(review.Id, cmd.Title, cmd.Target, cmd.DueDate);
        review.AddGoal(goal);
        await db.SaveChangesAsync(ct);

        return Result.Success(PerformanceMappings.ToDto(review));
    }
}
