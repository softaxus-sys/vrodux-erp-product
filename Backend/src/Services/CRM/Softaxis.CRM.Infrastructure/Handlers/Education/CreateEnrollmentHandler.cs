using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class CreateEnrollmentHandler(CrmDbContext db) : ICommandHandler<CreateEnrollmentCommand, EnrollmentDto>
{
    public async Task<Result<EnrollmentDto>> Handle(CreateEnrollmentCommand cmd, CancellationToken ct)
    {
        var e = new Enrollment(cmd.StudentId, cmd.StudentName, cmd.Course, cmd.Term ?? "", cmd.FeeTotal, cmd.Notes);
        db.Enrollments.Add(e);
        await db.SaveChangesAsync(ct);

        return Result.Success(EducationMappings.ToDto(e));
    }
}
