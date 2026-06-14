using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class DeletePatientHandler(CrmDbContext db) : ICommandHandler<DeletePatientCommand>
{
    public async Task<Result> Handle(DeletePatientCommand cmd, CancellationToken ct)
    {
        var p = await db.Patients.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Patient", cmd.Id));

        p.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
