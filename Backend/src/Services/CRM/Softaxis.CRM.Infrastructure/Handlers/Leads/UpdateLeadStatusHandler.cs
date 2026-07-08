using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class UpdateLeadStatusHandler(CrmDbContext db, ILeadAccessGuard access) : ICommandHandler<UpdateLeadStatusCommand>
{
    public async Task<Result> Handle(UpdateLeadStatusCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null || !access.CanEdit(l))
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        l.UpdateStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
