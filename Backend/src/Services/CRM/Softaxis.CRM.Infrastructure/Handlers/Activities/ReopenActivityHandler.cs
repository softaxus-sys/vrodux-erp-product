using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class ReopenActivityHandler(CrmDbContext db) : ICommandHandler<ReopenActivityCommand>
{
    public async Task<Result> Handle(ReopenActivityCommand cmd, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));

        a.Reopen();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
