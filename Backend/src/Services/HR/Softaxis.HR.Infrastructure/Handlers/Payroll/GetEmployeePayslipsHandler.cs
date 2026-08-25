using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class GetEmployeePayslipsHandler(HrDbContext db)
    : IQueryHandler<GetEmployeePayslipsQuery, IReadOnlyList<EmployeePayslipDto>>
{
    // A payslip only exists once the run has left draft — draft/rejected runs are still
    // being edited, so surfacing them as "payslips" would misrepresent what was paid out.
    private static readonly string[] IssuedStatuses = ["processed", "paid"];

    public async Task<Result<IReadOnlyList<EmployeePayslipDto>>> Handle(
        GetEmployeePayslipsQuery query, CancellationToken ct)
    {
        // Written as an explicit join over the two DbSets rather than SelectMany over the Slips
        // navigation: with the tenant query filter applied to both entities, EF cannot translate
        // the navigation form and throws at runtime.
        var items = await (
            from slip in db.PayrollSlips.AsNoTracking()
            join run in db.PayrollRuns.AsNoTracking() on slip.PayrollRunId equals run.Id
            where slip.EmployeeId == query.EmployeeId
                  && !run.IsDeleted
                  && IssuedStatuses.Contains(run.Status)
            orderby run.Period descending
            select new EmployeePayslipDto(
                run.Id, slip.Id, run.RunNumber, run.Period, run.Status,
                slip.BasicSalary, slip.Allowances, slip.Deductions, slip.NetSalary,
                run.ProcessedAt, run.PaidAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<EmployeePayslipDto>>(items);
    }
}
