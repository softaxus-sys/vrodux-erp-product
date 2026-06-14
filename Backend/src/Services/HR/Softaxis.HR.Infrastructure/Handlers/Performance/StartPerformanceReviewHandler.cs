using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class StartPerformanceReviewHandler(HrDbContext db)
    : ICommandHandler<StartPerformanceReviewCommand>
{
    public async Task<Result> Handle(StartPerformanceReviewCommand cmd, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (review is null)
            return Result.Failure(Error.NotFoundById("PerformanceReview", cmd.Id));

        if (review.Status != "pending")
            return Result.Failure(Error.Custom("PerformanceReview.InvalidStatus", "Only pending reviews can be started."));

        review.Start();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
