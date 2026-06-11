using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class GetPayrollSummaryHandler(HrDbContext db)
    : IQueryHandler<GetPayrollSummaryQuery, PayrollSummaryDto>
{
    public async Task<Result<PayrollSummaryDto>> Handle(GetPayrollSummaryQuery query, CancellationToken ct)
    {
        var thisPeriod = DateTime.UtcNow.ToString("yyyy-MM");

        var statusCounts = await db.PayrollRuns
            .AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var draft     = statusCounts.FirstOrDefault(c => c.Status == "draft")?.Count     ?? 0;
        var processed = statusCounts.FirstOrDefault(c => c.Status == "processed")?.Count ?? 0;
        var paid      = statusCounts.FirstOrDefault(c => c.Status == "paid")?.Count      ?? 0;

        var thisMonthRun = await db.PayrollRuns
            .AsNoTracking()
            .Where(x => x.Period == thisPeriod)
            .Select(x => new PayrollThisMonthDto(x.Status, x.TotalNetSalary, x.Slips.Count))
            .FirstOrDefaultAsync(ct);

        return Result.Success(new PayrollSummaryDto(
            new PayrollAllTimeDto(draft, processed, paid, draft + processed + paid),
            thisMonthRun));
    }
}
