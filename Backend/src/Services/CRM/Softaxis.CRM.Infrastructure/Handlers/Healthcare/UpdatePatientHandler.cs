using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class UpdatePatientHandler(CrmDbContext db) : ICommandHandler<UpdatePatientCommand>
{
    public async Task<Result> Handle(UpdatePatientCommand cmd, CancellationToken ct)
    {
        var p = await db.Patients.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Patient", cmd.Id));

        p.Update(cmd.FullName, cmd.Gender ?? "", cmd.DateOfBirth, cmd.Phone ?? "", cmd.Email,
            cmd.BloodGroup, cmd.AssignedDoctor, cmd.Status, cmd.Notes);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
