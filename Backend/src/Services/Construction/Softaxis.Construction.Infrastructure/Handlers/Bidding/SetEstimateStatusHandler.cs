using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class SetEstimateStatusHandler(ConstructionDbContext db)
    : ICommandHandler<SetEstimateStatusCommand>
{
    public async Task<Result> Handle(SetEstimateStatusCommand cmd, CancellationToken ct)
    {
        var e = await db.Estimates.FindAsync([cmd.Id], ct);
        if (e is null)
            return Result.Failure(Error.NotFoundById("Estimate", cmd.Id));

        e.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
