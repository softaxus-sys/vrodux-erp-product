using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class ResolveTicketHandler(CrmDbContext db) : ICommandHandler<ResolveTicketCommand>
{
    public async Task<Result> Handle(ResolveTicketCommand cmd, CancellationToken ct)
    {
        var t = await db.SupportTickets.FindAsync([cmd.Id], ct);
        if (t is null)
            return Result.Failure(Error.NotFoundById("SupportTicket", cmd.Id));

        t.Resolve(cmd.Resolution);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
