using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Education.Dtos;
using Softaxis.CRM.Application.Education.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Education;

internal sealed class GetEducationSummaryHandler(CrmDbContext db) : IQueryHandler<GetEducationSummaryQuery, EducationSummaryDto>
{
    public async Task<Result<EducationSummaryDto>> Handle(GetEducationSummaryQuery query, CancellationToken ct)
    {
        // ApplyTenantId replaces the configuration filter on IsDeleted, so it is applied by hand.
        // Without it these totals counted rows the lists no longer show.
        var adm = await db.Admissions.AsNoTracking().Where(x => !x.IsDeleted).Select(x => x.Status).ToListAsync(ct);
        var students = await db.Students.AsNoTracking().Where(x => !x.IsDeleted).CountAsync(x => x.Status == "enrolled", ct);
        var enr = await db.Enrollments.AsNoTracking().Where(x => !x.IsDeleted).Select(x => new { x.FeeTotal, x.FeePaid }).ToListAsync(ct);

        return Result.Success(new EducationSummaryDto(
            adm.Count(s => s is "inquiry" or "applied" or "offer"),
            adm.Count,
            students,
            enr.Count,
            enr.Sum(x => x.FeeTotal),
            enr.Sum(x => x.FeePaid),
            enr.Sum(x => Math.Max(0, x.FeeTotal - x.FeePaid))));
    }
}
