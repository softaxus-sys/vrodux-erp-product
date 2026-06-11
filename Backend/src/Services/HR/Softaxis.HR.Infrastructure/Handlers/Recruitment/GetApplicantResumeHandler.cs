using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Application.Recruitment.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class GetApplicantResumeHandler(HrDbContext db)
    : IQueryHandler<GetApplicantResumeQuery, ApplicantResumeDto>
{
    public async Task<Result<ApplicantResumeDto>> Handle(GetApplicantResumeQuery query, CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (applicant is null || string.IsNullOrEmpty(applicant.ResumeStoragePath))
            return Result.Failure<ApplicantResumeDto>(Error.NotFoundById("ApplicantResume", query.Id));

        return Result.Success(new ApplicantResumeDto(applicant.ResumeStoragePath, applicant.ResumeFileName));
    }
}
