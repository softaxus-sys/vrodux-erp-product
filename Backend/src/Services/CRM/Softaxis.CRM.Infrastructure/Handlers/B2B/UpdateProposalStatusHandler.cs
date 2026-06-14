using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class UpdateProposalStatusHandler(CrmDbContext db) : ICommandHandler<UpdateProposalStatusCommand>
{
    public async Task<Result> Handle(UpdateProposalStatusCommand cmd, CancellationToken ct)
    {
        var p = await db.Proposals.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Proposal", cmd.Id));

        p.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
