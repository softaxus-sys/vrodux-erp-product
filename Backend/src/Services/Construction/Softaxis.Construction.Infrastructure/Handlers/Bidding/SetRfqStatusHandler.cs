using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class SetRfqStatusHandler(ConstructionDbContext db)
    : ICommandHandler<SetRfqStatusCommand>
{
    public async Task<Result> Handle(SetRfqStatusCommand cmd, CancellationToken ct)
    {
        var e = await db.Rfqs.FindAsync([cmd.Id], ct);
        if (e is null)
            return Result.Failure(Error.NotFoundById("Rfq", cmd.Id));

        e.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
