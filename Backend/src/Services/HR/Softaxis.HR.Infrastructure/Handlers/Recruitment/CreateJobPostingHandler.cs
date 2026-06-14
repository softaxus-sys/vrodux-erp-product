using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Application.Recruitment.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class CreateJobPostingHandler(HrDbContext db)
    : ICommandHandler<CreateJobPostingCommand, JobPostingDto>
{
    public async Task<Result<JobPostingDto>> Handle(CreateJobPostingCommand cmd, CancellationToken ct)
    {
        var job = new JobPosting(
            cmd.Title, cmd.Department, cmd.Branch, cmd.Type, cmd.ExperienceLevel,
            cmd.Headcount, cmd.SalaryMin, cmd.SalaryMax, cmd.Currency,
            cmd.ClosingDate, cmd.HiringManager, cmd.Description,
            RecruitmentMappings.JoinLines(cmd.Requirements), RecruitmentMappings.JoinLines(cmd.Responsibilities),
            cmd.Status);

        db.JobPostings.Add(job);
        await db.SaveChangesAsync(ct);

        return Result.Success(RecruitmentMappings.ToDto(job));
    }
}
