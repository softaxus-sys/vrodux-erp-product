using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class DeleteAdmissionHandler(CrmDbContext db) : ICommandHandler<DeleteAdmissionCommand>
{
    public async Task<Result> Handle(DeleteAdmissionCommand cmd, CancellationToken ct)
    {
        var a = await db.Admissions.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Admission", cmd.Id));

        a.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
