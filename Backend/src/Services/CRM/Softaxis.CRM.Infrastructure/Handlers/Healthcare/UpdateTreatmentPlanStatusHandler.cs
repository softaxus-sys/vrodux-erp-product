using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class UpdateTreatmentPlanStatusHandler(CrmDbContext db) : ICommandHandler<UpdateTreatmentPlanStatusCommand>
{
    public async Task<Result> Handle(UpdateTreatmentPlanStatusCommand cmd, CancellationToken ct)
    {
        var p = await db.TreatmentPlans.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("TreatmentPlan", cmd.Id));

        p.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
