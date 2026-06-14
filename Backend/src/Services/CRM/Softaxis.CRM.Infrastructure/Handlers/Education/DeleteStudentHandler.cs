using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class DeleteStudentHandler(CrmDbContext db) : ICommandHandler<DeleteStudentCommand>
{
    public async Task<Result> Handle(DeleteStudentCommand cmd, CancellationToken ct)
    {
        var s = await db.Students.FindAsync([cmd.Id], ct);
        if (s is null)
            return Result.Failure(Error.NotFoundById("Student", cmd.Id));

        s.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
