using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class RejectPayrollRunHandler(HrDbContext db)
    : ICommandHandler<RejectPayrollRunCommand>
{
    public async Task<Result> Handle(RejectPayrollRunCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FindAsync([cmd.Id], ct);
        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.Id));

        // Draft (HR rejecting its own run) or processed (Finance sending it back). A run that is
        // already approved or paid is past the point where rejecting it would mean anything.
        if (run.Status is not ("draft" or "processed"))
            return Result.Failure(Error.Custom("PayrollRun.Conflict",
                "Only draft or processed payroll runs can be rejected."));

        run.MarkRejected(cmd.Reason, cmd.RejectedByName ?? "Admin");
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
