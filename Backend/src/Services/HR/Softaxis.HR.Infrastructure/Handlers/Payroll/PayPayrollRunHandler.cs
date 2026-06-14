using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class PayPayrollRunHandler(HrDbContext db)
    : ICommandHandler<PayPayrollRunCommand>
{
    public async Task<Result> Handle(PayPayrollRunCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FindAsync([cmd.Id], ct);
        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.Id));

        if (run.Status != "processed")
            return Result.Failure(Error.Custom("PayrollRun.Conflict", "Only processed payroll runs can be marked as paid."));

        run.MarkPaid();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
