using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class CreateApplicantHandler(HrDbContext db)
    : ICommandHandler<CreateApplicantCommand, ApplicantDto>
{
    public async Task<Result<ApplicantDto>> Handle(CreateApplicantCommand cmd, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == cmd.JobId, ct);
        if (job is null)
            return Result.Failure<ApplicantDto>(Error.NotFoundById("JobPosting", cmd.JobId));

        var applicant = new Applicant(
            cmd.JobId, job.Title, cmd.Name, cmd.Email, cmd.Phone, cmd.Nationality,
            cmd.CurrentRole, cmd.CurrentCompany, cmd.Experience, cmd.Source, cmd.Notes);

        job.IncrementApplicants();
        db.Applicants.Add(applicant);
        await db.SaveChangesAsync(ct);

        return Result.Success(RecruitmentMappings.ToDto(applicant));
    }
}
