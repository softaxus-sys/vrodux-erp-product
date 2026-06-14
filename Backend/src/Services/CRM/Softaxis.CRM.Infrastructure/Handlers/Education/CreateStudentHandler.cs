using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class CreateStudentHandler(CrmDbContext db) : ICommandHandler<CreateStudentCommand, StudentDto>
{
    public async Task<Result<StudentDto>> Handle(CreateStudentCommand cmd, CancellationToken ct)
    {
        var s = new Student(cmd.CustomerId, cmd.FullName, cmd.Gender ?? "", cmd.Program ?? "",
            cmd.GuardianName, cmd.Phone, cmd.Email, cmd.Notes);
        db.Students.Add(s);
        await db.SaveChangesAsync(ct);

        return Result.Success(EducationMappings.ToDto(s));
    }
}
