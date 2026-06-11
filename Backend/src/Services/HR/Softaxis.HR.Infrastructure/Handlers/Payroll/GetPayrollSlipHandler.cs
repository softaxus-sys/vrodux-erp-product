using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Payroll.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class GetPayrollSlipHandler(HrDbContext db)
    : IQueryHandler<GetPayrollSlipQuery, PayrollSlipDetailDto>
{
    public async Task<Result<PayrollSlipDetailDto>> Handle(GetPayrollSlipQuery query, CancellationToken ct)
    {
        var slip = await db.PayrollSlips
            .AsNoTracking()
            .Include(x => x.PayrollRun)
            .FirstOrDefaultAsync(x => x.PayrollRunId == query.RunId && x.Id == query.SlipId, ct);

        if (slip is null)
            return Result.Failure<PayrollSlipDetailDto>(Error.NotFoundById("PayrollSlip", query.SlipId));

        return Result.Success(new PayrollSlipDetailDto(
            slip.Id, slip.EmployeeId, slip.EmployeeName, slip.JobTitle, slip.DepartmentName,
            slip.BasicSalary, slip.Allowances, slip.Deductions, slip.NetSalary, slip.Notes,
            slip.EmailSentAt, slip.EmailSentTo,
            slip.PayrollRun!.Period, slip.PayrollRun!.RunNumber, slip.PayrollRun!.Status, slip.PayrollRun!.PaidAt));
    }
}
