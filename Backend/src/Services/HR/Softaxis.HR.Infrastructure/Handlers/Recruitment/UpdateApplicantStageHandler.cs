using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Recruitment.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Recruitment;

internal sealed class UpdateApplicantStageHandler(HrDbContext db)
    : ICommandHandler<UpdateApplicantStageCommand>
{
    public async Task<Result> Handle(UpdateApplicantStageCommand cmd, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);
        if (applicant is null)
            return Result.Failure(Error.NotFoundById("Applicant", cmd.Id));

        applicant.SetStage(cmd.Stage);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
