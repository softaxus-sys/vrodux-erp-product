using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class DeleteApplicantHandler(HrDbContext db)
    : ICommandHandler<DeleteApplicantCommand>
{
    public async Task<Result> Handle(DeleteApplicantCommand cmd, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (applicant is null)
            return Result.Failure(Error.NotFoundById("Applicant", cmd.Id));

        var job = await db.JobPostings.FirstOrDefaultAsync(x => x.Id == applicant.JobPostingId, ct);
        job?.DecrementApplicants();

        applicant.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
