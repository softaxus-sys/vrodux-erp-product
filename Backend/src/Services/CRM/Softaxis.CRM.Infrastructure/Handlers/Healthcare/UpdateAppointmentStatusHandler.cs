using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class UpdateAppointmentStatusHandler(CrmDbContext db) : ICommandHandler<UpdateAppointmentStatusCommand>
{
    public async Task<Result> Handle(UpdateAppointmentStatusCommand cmd, CancellationToken ct)
    {
        var a = await db.Appointments.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Appointment", cmd.Id));

        a.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
