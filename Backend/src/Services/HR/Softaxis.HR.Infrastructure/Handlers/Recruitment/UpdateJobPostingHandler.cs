using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class UpdateJobPostingHandler(HrDbContext db)
    : ICommandHandler<UpdateJobPostingCommand>
{
    public async Task<Result> Handle(UpdateJobPostingCommand cmd, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (job is null)
            return Result.Failure(Error.NotFoundById("JobPosting", cmd.Id));

        job.Update(
            cmd.Title, cmd.Department, cmd.Branch, cmd.Type, cmd.ExperienceLevel,
            cmd.Headcount, cmd.SalaryMin, cmd.SalaryMax, cmd.Currency,
            cmd.ClosingDate, cmd.HiringManager, cmd.Description,
            RecruitmentMappings.JoinLines(cmd.Requirements), RecruitmentMappings.JoinLines(cmd.Responsibilities),
            cmd.Status);

        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
