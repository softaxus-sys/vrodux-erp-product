using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class DeleteLeadHandler(CrmDbContext db) : ICommandHandler<DeleteLeadCommand>
{
    public async Task<Result> Handle(DeleteLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null)
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        l.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
