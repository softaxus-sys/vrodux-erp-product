using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class SetContractStatusHandler(ConstructionDbContext db)
    : ICommandHandler<SetContractStatusCommand>
{
    public async Task<Result> Handle(SetContractStatusCommand cmd, CancellationToken ct)
    {
        var c = await db.Contracts.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("ConstructionContract", cmd.Id));

        c.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
