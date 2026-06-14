using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class CreateAdmissionHandler(CrmDbContext db) : ICommandHandler<CreateAdmissionCommand, AdmissionDto>
{
    public async Task<Result<AdmissionDto>> Handle(CreateAdmissionCommand cmd, CancellationToken ct)
    {
        var a = new Admission(cmd.LeadId, cmd.ApplicantName, cmd.Program, cmd.IntakeTerm ?? "",
            cmd.GuardianName, cmd.Phone, cmd.Email, cmd.Notes);
        db.Admissions.Add(a);
        await db.SaveChangesAsync(ct);

        return Result.Success(EducationMappings.ToDto(a));
    }
}
