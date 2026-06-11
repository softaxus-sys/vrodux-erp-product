using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class UpdateLeadScoreHandler(CrmDbContext db) : ICommandHandler<UpdateLeadScoreCommand>
{
    public async Task<Result> Handle(UpdateLeadScoreCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        if (l is null)
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        l.UpdateScore(cmd.Score);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
