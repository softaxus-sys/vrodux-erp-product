using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class UpdateActivityHandler(CrmDbContext db, ILeadAccessGuard access) : ICommandHandler<UpdateActivityCommand>
{
    public async Task<Result> Handle(UpdateActivityCommand cmd, CancellationToken ct)
    {
        var a = await db.Activities.FindAsync([cmd.Id], ct);
        if (a is null)
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));
        if (!await access.CanManageActivityAsync(a.RelatedToType, a.RelatedToId, ct))
            return Result.Failure(Error.NotFoundById("Activity", cmd.Id));

        a.Update(cmd.Type, cmd.Subject, cmd.Description, cmd.DueDate, cmd.AssignedTo);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
