using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class UpdatePayrollSlipHandler(HrDbContext db)
    : ICommandHandler<UpdatePayrollSlipCommand>
{
    public async Task<Result> Handle(UpdatePayrollSlipCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns
            .Include(x => x.Slips)
            .FirstOrDefaultAsync(x => x.Id == cmd.RunId, ct);

        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.RunId));

        if (run.Status != "rejected" && run.Status != "draft")
            return Result.Failure(Error.Custom("PayrollRun.Conflict", "Slips can only be edited on draft or rejected payroll runs."));

        var slip = run.Slips.FirstOrDefault(s => s.Id == cmd.SlipId);
        if (slip is null)
            return Result.Failure(Error.NotFoundById("PayrollSlip", cmd.SlipId));

        slip.Update(cmd.Allowances, cmd.Deductions, cmd.Notes);
        run.Recalculate();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
