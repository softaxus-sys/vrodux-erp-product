using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class UpdatePerformanceReviewHandler(HrDbContext db)
    : ICommandHandler<UpdatePerformanceReviewCommand>
{
    public async Task<Result> Handle(UpdatePerformanceReviewCommand cmd, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.Include(x => x.Goals).FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (review is null)
            return Result.Failure(Error.NotFoundById("PerformanceReview", cmd.Id));

        review.Update(cmd.ReviewPeriod, cmd.ReviewType, cmd.DueDate, cmd.ReviewedBy);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
