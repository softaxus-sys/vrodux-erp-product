using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Application.Healthcare.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class GetTreatmentPlansHandler(CrmDbContext db) : IQueryHandler<GetTreatmentPlansQuery, IReadOnlyList<TreatmentPlanDto>>
{
    public async Task<Result<IReadOnlyList<TreatmentPlanDto>>> Handle(GetTreatmentPlansQuery query, CancellationToken ct)
    {
        var q = db.TreatmentPlans.AsNoTracking().AsQueryable();
        if (query.PatientId.HasValue) q = q.Where(x => x.PatientId == query.PatientId.Value);

        var items = await q.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<TreatmentPlanDto>>(items.Select(HealthcareMappings.ToDto).ToList());
    }
}
