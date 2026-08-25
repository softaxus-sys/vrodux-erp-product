using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class CreatePayrollRunHandler(HrDbContext db)
    : ICommandHandler<CreatePayrollRunCommand, PayrollRunDetailDto>
{
    public async Task<Result<PayrollRunDetailDto>> Handle(CreatePayrollRunCommand cmd, CancellationToken ct)
    {
        var periodExists = await db.PayrollRuns
            .AnyAsync(x => x.Period == cmd.Period && x.Status != "draft", ct);
        if (periodExists)
            return Result.Failure<PayrollRunDetailDto>(Error.Custom(
                "PayrollRun.Duplicate", $"A processed payroll run already exists for period {cmd.Period}."));

        var run = new PayrollRun(cmd.Period, cmd.Notes, cmd.CreatedByUserId, cmd.CreatedByName);

        foreach (var s in cmd.Slips)
            run.Slips.Add(new PayrollSlip(
                run.Id, s.EmployeeId, s.EmployeeName,
                s.JobTitle, s.DepartmentName,
                s.BasicSalary, s.Allowances, s.Deductions, s.Notes));

        run.Recalculate();
        db.PayrollRuns.Add(run);
        await db.SaveChangesAsync(ct);

        var bank = await PayrollBankLookup.ForRunAsync(db, run, ct);
        return Result.Success(PayrollMappings.ToDetailDto(run, bank));
    }
}
