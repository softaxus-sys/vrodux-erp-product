using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class DeletePerformanceReviewHandler(HrDbContext db)
    : ICommandHandler<DeletePerformanceReviewCommand>
{
    public async Task<Result> Handle(DeletePerformanceReviewCommand cmd, CancellationToken ct)
    {
        var review = await db.PerformanceReviews.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (review is null)
            return Result.Failure(Error.NotFoundById("PerformanceReview", cmd.Id));

        review.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
