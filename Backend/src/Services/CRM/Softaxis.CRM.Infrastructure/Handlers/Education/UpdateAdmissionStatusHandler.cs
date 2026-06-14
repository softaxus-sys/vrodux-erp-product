using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class UpdateAdmissionStatusHandler(CrmDbContext db) : ICommandHandler<UpdateAdmissionStatusCommand>
{
    public async Task<Result> Handle(UpdateAdmissionStatusCommand cmd, CancellationToken ct)
    {
        var a = await db.Admissions.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Admission", cmd.Id));

        a.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
