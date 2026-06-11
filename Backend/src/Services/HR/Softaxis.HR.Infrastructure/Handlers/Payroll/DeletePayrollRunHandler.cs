using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class DeletePayrollRunHandler(HrDbContext db)
    : ICommandHandler<DeletePayrollRunCommand>
{
    public async Task<Result> Handle(DeletePayrollRunCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FindAsync([cmd.Id], ct);
        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.Id));

        if (run.Status != "draft")
            return Result.Failure(Error.Custom("PayrollRun.Conflict", "Only draft payroll runs can be deleted."));

        run.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
