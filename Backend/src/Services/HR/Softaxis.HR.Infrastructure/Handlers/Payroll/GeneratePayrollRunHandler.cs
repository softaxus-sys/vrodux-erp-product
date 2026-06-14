using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class GeneratePayrollRunHandler(HrDbContext db)
    : ICommandHandler<GeneratePayrollRunCommand, PayrollRunDetailDto>
{
    public async Task<Result<PayrollRunDetailDto>> Handle(GeneratePayrollRunCommand cmd, CancellationToken ct)
    {
        var periodExists = await db.PayrollRuns
            .AnyAsync(x => x.Period == cmd.Period && x.Status != "draft", ct);
        if (periodExists)
            return Result.Failure<PayrollRunDetailDto>(Error.Custom(
                "PayrollRun.Duplicate", $"A processed payroll run already exists for period {cmd.Period}."));

        var employees = await db.Employees
            .AsNoTracking()
            .Where(x => x.Status == "active")
            .ToListAsync(ct);

        if (employees.Count == 0)
            return Result.Failure<PayrollRunDetailDto>(Error.Custom(
                "Validation.Failed", "No active employees found."));

        var run = new PayrollRun(cmd.Period, cmd.Notes, cmd.CreatedByUserId, cmd.CreatedByName);

        foreach (var emp in employees)
            run.Slips.Add(new PayrollSlip(
                run.Id, emp.Id, emp.FullName,
                emp.JobTitle, emp.DepartmentName,
                emp.BasicSalary, 0m, 0m, null));

        run.Recalculate();
        db.PayrollRuns.Add(run);
        await db.SaveChangesAsync(ct);

        return Result.Success(PayrollMappings.ToDetailDto(run));
    }
}
