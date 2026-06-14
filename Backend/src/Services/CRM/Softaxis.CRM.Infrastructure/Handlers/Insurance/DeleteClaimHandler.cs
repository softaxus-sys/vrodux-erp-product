using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class DeleteClaimHandler(CrmDbContext db) : ICommandHandler<DeleteClaimCommand>
{
    public async Task<Result> Handle(DeleteClaimCommand cmd, CancellationToken ct)
    {
        var c = await db.InsuranceClaims.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("InsuranceClaim", cmd.Id));

        c.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
