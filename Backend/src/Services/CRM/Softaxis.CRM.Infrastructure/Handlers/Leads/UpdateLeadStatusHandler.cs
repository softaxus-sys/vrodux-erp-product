using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class UpdateLeadStatusHandler(CrmDbContext db, ILeadAccessGuard access, ILeadStatusRecorder statusRecorder) : ICommandHandler<UpdateLeadStatusCommand>
{
    public async Task<Result> Handle(UpdateLeadStatusCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null || !await access.CanEditAsync(l, ct))
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        var previousStatus = l.Status;
        l.UpdateStatus(cmd.Status);
        await statusRecorder.RecordChangeAsync(l, previousStatus, ct);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
