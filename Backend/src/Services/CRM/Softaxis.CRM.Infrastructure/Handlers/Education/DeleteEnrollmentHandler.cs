using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class DeleteEnrollmentHandler(CrmDbContext db) : ICommandHandler<DeleteEnrollmentCommand>
{
    public async Task<Result> Handle(DeleteEnrollmentCommand cmd, CancellationToken ct)
    {
        var e = await db.Enrollments.FindAsync([cmd.Id], ct);
        if (e is null)
            return Result.Failure(Error.NotFoundById("Enrollment", cmd.Id));

        e.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
