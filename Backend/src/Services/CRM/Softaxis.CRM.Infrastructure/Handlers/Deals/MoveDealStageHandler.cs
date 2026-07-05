using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class MoveDealStageHandler(CrmDbContext db) : ICommandHandler<MoveDealStageCommand>
{
    public async Task<Result> Handle(MoveDealStageCommand cmd, CancellationToken ct)
    {
        var d = await db.Deals.FindAsync([cmd.Id], ct);
        if (d is null)
            return Result.Failure(Error.NotFoundById("Deal", cmd.Id));

        d.MoveStage(cmd.Stage, cmd.Probability, cmd.ForecastCategory, cmd.LossReason);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
