using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class DeleteAppointmentHandler(CrmDbContext db) : ICommandHandler<DeleteAppointmentCommand>
{
    public async Task<Result> Handle(DeleteAppointmentCommand cmd, CancellationToken ct)
    {
        var a = await db.Appointments.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Appointment", cmd.Id));

        a.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
