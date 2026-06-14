using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class SetJobStatusHandler(HrDbContext db)
    : ICommandHandler<SetJobStatusCommand>
{
    public async Task<Result> Handle(SetJobStatusCommand cmd, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (job is null)
            return Result.Failure(Error.NotFoundById("JobPosting", cmd.Id));

        job.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
