using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Application.Recruitment.Queries;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class GetApplicantsHandler(HrDbContext db)
    : IQueryHandler<GetApplicantsQuery, PagedResult<ApplicantDto>>
{
    public async Task<Result<PagedResult<ApplicantDto>>> Handle(GetApplicantsQuery query, CancellationToken ct)
    {
        IQueryable<Applicant> q = db.Applicants.AsNoTracking();

        if (query.JobId is not null)
            q = q.Where(x => x.JobPostingId == query.JobId);

        if (!string.IsNullOrWhiteSpace(query.Stage))
            q = q.Where(x => x.Stage == query.Stage);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(ct);

        var dtos = items.Select(RecruitmentMappings.ToDto).ToList();

        return Result.Success(new PagedResult<ApplicantDto>(
            dtos, query.Page, query.PageSize, total, totalPages, query.Page < totalPages, query.Page > 1));
    }
}
