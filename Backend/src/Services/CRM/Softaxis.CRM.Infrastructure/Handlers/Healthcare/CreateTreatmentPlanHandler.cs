using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Commands;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class CreateTreatmentPlanHandler(CrmDbContext db) : ICommandHandler<CreateTreatmentPlanCommand, TreatmentPlanDto>
{
    public async Task<Result<TreatmentPlanDto>> Handle(CreateTreatmentPlanCommand cmd, CancellationToken ct)
    {
        var p = new TreatmentPlan(cmd.PatientId, cmd.PatientName, cmd.Diagnosis, cmd.Plan, cmd.Doctor,
            cmd.StartDate, cmd.FollowUpDate, cmd.Notes);
        db.TreatmentPlans.Add(p);
        await db.SaveChangesAsync(ct);

        return Result.Success(HealthcareMappings.ToDto(p));
    }
}
