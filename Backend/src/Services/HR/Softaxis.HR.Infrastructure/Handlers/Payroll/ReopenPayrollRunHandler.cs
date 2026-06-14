using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class ReopenPayrollRunHandler(HrDbContext db)
    : ICommandHandler<ReopenPayrollRunCommand>
{
    public async Task<Result> Handle(ReopenPayrollRunCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FindAsync([cmd.Id], ct);
        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.Id));

        if (run.Status != "rejected")
            return Result.Failure(Error.Custom("PayrollRun.Conflict", "Only rejected payroll runs can be reopened."));

        run.Reopen();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
