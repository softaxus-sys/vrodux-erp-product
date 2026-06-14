using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class PublishJobHandler(HrDbContext db)
    : ICommandHandler<PublishJobCommand>
{
    public async Task<Result> Handle(PublishJobCommand cmd, CancellationToken ct)
    {
        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (job is null)
            return Result.Failure(Error.NotFoundById("JobPosting", cmd.Id));

        job.SetStatus("open");
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
