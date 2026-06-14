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
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var patients = await db.Patients.AsNoTracking().CountAsync(ct);
        var appts = await db.Appointments.AsNoTracking().Select(a => new { a.Status, a.ScheduledAt }).ToListAsync(ct);
        var plans = await db.TreatmentPlans.AsNoTracking().CountAsync(x => x.Status == "active", ct);

        return Result.Success(new HealthcareSummaryDto(
            patients,
            appts.Count(a => a.Status == "scheduled"),
            appts.Count(a => a.Status == "scheduled" && a.ScheduledAt.StartsWith(today)),
            appts.Count(a => a.Status == "completed"),
            plans));
    }
}
