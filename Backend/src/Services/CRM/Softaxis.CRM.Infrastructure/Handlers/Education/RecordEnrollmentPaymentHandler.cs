using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class RecordEnrollmentPaymentHandler(CrmDbContext db) : ICommandHandler<RecordEnrollmentPaymentCommand, EnrollmentDto>
{
    public async Task<Result<EnrollmentDto>> Handle(RecordEnrollmentPaymentCommand cmd, CancellationToken ct)
    {
        var e = await db.Enrollments.FindAsync([cmd.Id], ct);
        if (e is null)
            return Result.Failure<EnrollmentDto>(Error.NotFoundById("Enrollment", cmd.Id));

        e.RecordPayment(cmd.Amount);
        await db.SaveChangesAsync(ct);

        return Result.Success(EducationMappings.ToDto(e));
    }
}
