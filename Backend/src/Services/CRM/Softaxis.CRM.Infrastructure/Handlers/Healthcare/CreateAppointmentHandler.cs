using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class CreateAppointmentHandler(CrmDbContext db) : ICommandHandler<CreateAppointmentCommand, AppointmentDto>
{
    public async Task<Result<AppointmentDto>> Handle(CreateAppointmentCommand cmd, CancellationToken ct)
    {
        var a = new Appointment(cmd.PatientId, cmd.PatientName, cmd.Doctor, cmd.Department, cmd.ScheduledAt, cmd.Reason, cmd.Notes);
        db.Appointments.Add(a);
        await db.SaveChangesAsync(ct);

        return Result.Success(HealthcareMappings.ToDto(a));
    }
}
