using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class DeleteActivityHandler(CrmDbContext db) : ICommandHandler<DeleteActivityCommand>
{
    public async Task<Result> Handle(DeleteActivityCommand cmd, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));

        a.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
