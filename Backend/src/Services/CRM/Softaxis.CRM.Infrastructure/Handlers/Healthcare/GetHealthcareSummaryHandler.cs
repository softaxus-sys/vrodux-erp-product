using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Healthcare.Dtos;
using Softaxis.CRM.Application.Healthcare.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Healthcare;

internal sealed class GetHealthcareSummaryHandler(CrmDbContext db) : IQueryHandler<GetHealthcareSummaryQuery, HealthcareSummaryDto>
{
    public async Task<Result<HealthcareSummaryDto>> Handle(GetHealthcareSummaryQuery query, CancellationToken ct)
    {
        // ApplyTenantId replaces the configuration filter on IsDeleted, so it is applied by hand.
        // Without it these totals counted rows the lists no longer show.
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var patients = await db.Patients.AsNoTracking().Where(x => !x.IsDeleted).CountAsync(ct);
        var appts = await db.Appointments.AsNoTracking().Where(x => !x.IsDeleted).Select(a => new { a.Status, a.ScheduledAt }).ToListAsync(ct);
        var plans = await db.TreatmentPlans.AsNoTracking().Where(x => !x.IsDeleted).CountAsync(x => x.Status == "active", ct);

        return Result.Success(new HealthcareSummaryDto(
            patients,
            appts.Count(a => a.Status == "scheduled"),
            appts.Count(a => a.Status == "scheduled" && a.ScheduledAt.StartsWith(today)),
            appts.Count(a => a.Status == "completed"),
            plans));
    }
}
