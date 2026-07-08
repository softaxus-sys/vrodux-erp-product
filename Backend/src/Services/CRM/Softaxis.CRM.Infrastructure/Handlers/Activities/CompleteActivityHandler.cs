using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class CompleteActivityHandler(CrmDbContext db, ILeadAccessGuard access) : ICommandHandler<CompleteActivityCommand>
{
    public async Task<Result> Handle(CompleteActivityCommand cmd, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));
        if (!await access.CanManageActivityAsync(a.RelatedToType, a.RelatedToId, ct))
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));

        a.Complete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
