using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Application.Recruitment.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class GetApplicantByIdHandler(HrDbContext db)
    : IQueryHandler<GetApplicantByIdQuery, ApplicantDto>
{
    public async Task<Result<ApplicantDto>> Handle(GetApplicantByIdQuery query, CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (applicant is null)
            return Result.Failure<ApplicantDto>(Error.NotFoundById("Applicant", query.Id));

        return Result.Success(RecruitmentMappings.ToDto(applicant));
    }
}
