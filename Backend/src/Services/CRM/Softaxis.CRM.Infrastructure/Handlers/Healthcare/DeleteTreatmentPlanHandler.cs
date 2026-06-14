using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class DeleteTreatmentPlanHandler(CrmDbContext db) : ICommandHandler<DeleteTreatmentPlanCommand>
{
    public async Task<Result> Handle(DeleteTreatmentPlanCommand cmd, CancellationToken ct)
    {
        var p = await db.TreatmentPlans.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("TreatmentPlan", cmd.Id));

        p.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
