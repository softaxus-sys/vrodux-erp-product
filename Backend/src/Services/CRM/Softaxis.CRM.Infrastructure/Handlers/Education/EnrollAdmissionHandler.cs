using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class EnrollAdmissionHandler(CrmDbContext db) : ICommandHandler<EnrollAdmissionCommand, EnrollAdmissionResultDto>
{
    public async Task<Result<EnrollAdmissionResultDto>> Handle(EnrollAdmissionCommand cmd, CancellationToken ct)
    {
        var a = await db.Admissions.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure<EnrollAdmissionResultDto>(Error.NotFoundById("Admission", cmd.Id));

        var student = new Student(null, a.ApplicantName, "", a.Program, a.GuardianName, a.Phone, a.Email, a.Notes);
        db.Students.Add(student);
        a.LinkStudent(student.Id);
        await db.SaveChangesAsync(ct);

        return Result.Success(new EnrollAdmissionResultDto(student.Id, student.StudentNumber));
    }
}
