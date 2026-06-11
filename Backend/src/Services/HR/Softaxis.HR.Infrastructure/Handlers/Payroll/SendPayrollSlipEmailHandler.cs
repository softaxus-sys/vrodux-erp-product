using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class SendPayrollSlipEmailHandler(HrDbContext db)
    : ICommandHandler<SendPayrollSlipEmailCommand, SendPayrollSlipEmailResultDto>
{
    public async Task<Result<SendPayrollSlipEmailResultDto>> Handle(SendPayrollSlipEmailCommand cmd, CancellationToken ct)
    {
        var slip = await db.PayrollSlips
            .Include(x => x.PayrollRun)
            .FirstOrDefaultAsync(x => x.PayrollRunId == cmd.RunId && x.Id == cmd.SlipId, ct);

        if (slip is null)
            return Result.Failure<SendPayrollSlipEmailResultDto>(Error.NotFoundById("PayrollSlip", cmd.SlipId));

        var employee = await db.Employees
            .AsNoTracking()
            .Where(x => x.Id == slip.EmployeeId)
            .Select(x => new { x.Email, x.FullName })
            .FirstOrDefaultAsync(ct);

        if (employee is null || string.IsNullOrWhiteSpace(employee.Email))
            return Result.Failure<SendPayrollSlipEmailResultDto>(Error.Custom(
                "Employee.NoEmail", "Employee email address not found. Please update the employee profile."));

        slip.MarkEmailSent(employee.Email);
        await db.SaveChangesAsync(ct);

        return Result.Success(new SendPayrollSlipEmailResultDto(employee.Email, slip.EmailSentAt));
    }
}
