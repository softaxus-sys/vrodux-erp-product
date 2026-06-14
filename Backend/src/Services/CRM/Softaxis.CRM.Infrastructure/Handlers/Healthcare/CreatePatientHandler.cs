using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class CreatePatientHandler(CrmDbContext db) : ICommandHandler<CreatePatientCommand, PatientDto>
{
    public async Task<Result<PatientDto>> Handle(CreatePatientCommand cmd, CancellationToken ct)
    {
        var p = new Patient(cmd.LeadId, cmd.CustomerId, cmd.FullName, cmd.Gender ?? "", cmd.DateOfBirth,
            cmd.Phone ?? "", cmd.Email, cmd.BloodGroup, cmd.AssignedDoctor, cmd.Notes);
        db.Patients.Add(p);
        await db.SaveChangesAsync(ct);

        return Result.Success(HealthcareMappings.ToDto(p));
    }
}
