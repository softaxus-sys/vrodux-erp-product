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

        // "processed" is editable too, because that is exactly when Finance reviews the run, and
        // Finance was asked to be able to correct a figure rather than bounce the whole run back
        // to HR. Once Finance has signed off — or the money has moved — the figures are fixed.
        if (run.Status is not ("draft" or "rejected" or "processed"))
            return Result.Failure(Error.Custom("PayrollRun.Conflict",
                "Slips can only be edited before Finance approves the run."));

        var slip = run.Slips.FirstOrDefault(s => s.Id == cmd.SlipId);
        if (slip is null)
            return Result.Failure(Error.NotFoundById("PayrollSlip", cmd.SlipId));

        slip.Update(cmd.Allowances, cmd.Deductions, cmd.Notes);
        run.Recalculate();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
