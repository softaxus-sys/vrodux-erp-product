using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class DeleteProposalHandler(CrmDbContext db) : ICommandHandler<DeleteProposalCommand>
{
    public async Task<Result> Handle(DeleteProposalCommand cmd, CancellationToken ct)
    {
        var p = await db.Proposals.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Proposal", cmd.Id));

        p.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
