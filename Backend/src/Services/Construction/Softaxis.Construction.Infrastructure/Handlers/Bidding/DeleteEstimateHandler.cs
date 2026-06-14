using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class DeleteEstimateHandler(ConstructionDbContext db)
    : ICommandHandler<DeleteEstimateCommand>
{
    public async Task<Result> Handle(DeleteEstimateCommand cmd, CancellationToken ct)
    {
        var e = await db.Estimates.FindAsync([cmd.Id], ct);
        if (e is null)
            return Result.Failure(Error.NotFoundById("Estimate", cmd.Id));

        e.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
