using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Performance.Dtos;
using Softaxis.HR.Application.Performance.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal sealed class GetPerformanceReviewsHandler(HrDbContext db)
    : IQueryHandler<GetPerformanceReviewsQuery, PagedResult<ReviewDto>>
{
    public async Task<Result<PagedResult<ReviewDto>>> Handle(GetPerformanceReviewsQuery query, CancellationToken ct)
    {
        IQueryable<PerformanceReview> q = db.PerformanceReviews
            .AsNoTracking()
            .Include(x => x.Goals);

        if (query.EmployeeId is not null)
            q = q.Where(x => x.EmployeeId == query.EmployeeId);

        var all  = await q.OrderBy(x => x.DueDate).ToListAsync(ct);
        var dtos = all.Select(PerformanceMappings.ToDto).ToList();

        if (!string.IsNullOrWhiteSpace(query.Status))
            dtos = dtos.Where(x => x.Status == query.Status).ToList();

        return Result.Success(PagedResult<ReviewDto>.Create(dtos, query.Page, query.PageSize));
    }
}
