using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Application.Recruitment.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class GetJobPostingByIdHandler(HrDbContext db)
    : IQueryHandler<GetJobPostingByIdQuery, JobPostingDto>
{
    public async Task<Result<JobPostingDto>> Handle(GetJobPostingByIdQuery query, CancellationToken ct)
    {
        var job = await db.JobPostings.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (job is null)
            return Result.Failure<JobPostingDto>(Error.NotFoundById("JobPosting", query.Id));

        return Result.Success(RecruitmentMappings.ToDto(job));
    }
}
