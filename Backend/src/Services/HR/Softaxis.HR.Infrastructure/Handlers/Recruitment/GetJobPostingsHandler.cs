using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Application.Recruitment.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class GetJobPostingsHandler(HrDbContext db)
    : IQueryHandler<GetJobPostingsQuery, PagedResult<JobPostingDto>>
{
    public async Task<Result<PagedResult<JobPostingDto>>> Handle(GetJobPostingsQuery query, CancellationToken ct)
    {
        IQueryable<JobPosting> q = db.JobPostings.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(ct);

        var dtos = items.Select(RecruitmentMappings.ToDto).ToList();

        return Result.Success(new PagedResult<JobPostingDto>(
            dtos, query.Page, query.PageSize, total, totalPages, query.Page < totalPages, query.Page > 1));
    }
}
