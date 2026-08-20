using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class DeleteLeadHandler(CrmDbContext db, ILeadAccessGuard access) : ICommandHandler<DeleteLeadCommand>
{
    public async Task<Result> Handle(DeleteLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null)
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        // Defence in depth. The controller already requires crm.leads.delete, which no restricted
        // tier holds — but if that key is ever granted alongside a team/assigned tier, deletion must
        // still respect the hierarchy rather than reaching any lead in the tenant. NotFound (not
        // Forbidden) keeps it consistent with every other per-lead check here.
        if (!await access.CanReadAsync(l, ct))
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        l.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
