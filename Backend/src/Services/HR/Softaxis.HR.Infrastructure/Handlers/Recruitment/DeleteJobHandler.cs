using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class DeleteJobHandler(HrDbContext db)
    : ICommandHandler<DeleteJobCommand>
{
    public async Task<Result> Handle(DeleteJobCommand cmd, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (job is null)
            return Result.Failure(Error.NotFoundById("JobPosting", cmd.Id));

        job.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
