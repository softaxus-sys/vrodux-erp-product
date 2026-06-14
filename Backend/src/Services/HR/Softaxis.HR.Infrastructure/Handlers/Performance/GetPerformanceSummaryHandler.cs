using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Performance.Dtos;
using Softaxis.HR.Application.Performance.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class GetPerformanceSummaryHandler(HrDbContext db)
    : IQueryHandler<GetPerformanceSummaryQuery, PerformanceSummaryDto>
{
    public async Task<Result<PerformanceSummaryDto>> Handle(GetPerformanceSummaryQuery query, CancellationToken ct)
    {
        var reviews = await db.PerformanceReviews.AsNoTracking().ToListAsync(ct);

        var total      = reviews.Count;
        var completed  = reviews.Count(x => x.Status == "completed");
        var pending    = reviews.Count(x => x.Status == "pending" && !PerformanceMappings.IsOverdue(x));
        var overdue    = reviews.Count(PerformanceMappings.IsOverdue);
        var inProgress = reviews.Count(x => x.Status == "in_progress" && !PerformanceMappings.IsOverdue(x));

        var rated      = reviews.Where(x => x.OverallRating.HasValue).ToList();
        var avgRating  = rated.Count == 0 ? 0 : Math.Round(rated.Average(x => x.OverallRating!.Value), 1);

        return Result.Success(new PerformanceSummaryDto(total, completed, pending, inProgress, overdue, avgRating));
    }
}
