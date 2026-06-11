using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Dtos;
using Softaxis.HR.Application.Performance.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class GetPerformanceReviewByIdHandler(HrDbContext db)
    : IQueryHandler<GetPerformanceReviewByIdQuery, ReviewDto>
{
    public async Task<Result<ReviewDto>> Handle(GetPerformanceReviewByIdQuery query, CancellationToken ct)
    {
        var review = await db.PerformanceReviews
            .AsNoTracking()
            .Include(x => x.Goals)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (review is null)
            return Result.Failure<ReviewDto>(Error.NotFoundById("PerformanceReview", query.Id));

        return Result.Success(PerformanceMappings.ToDto(review));
    }
}
