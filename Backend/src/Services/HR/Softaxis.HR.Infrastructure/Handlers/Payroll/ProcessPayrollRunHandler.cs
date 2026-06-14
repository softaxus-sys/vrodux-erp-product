using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class ProcessPayrollRunHandler(HrDbContext db)
    : ICommandHandler<ProcessPayrollRunCommand>
{
    public async Task<Result> Handle(ProcessPayrollRunCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns
            .Include(x => x.Slips)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.Id));

        if (run.Status != "draft")
            return Result.Failure(Error.Custom("PayrollRun.Conflict", "Only draft payroll runs can be processed."));

        run.Recalculate();
        run.MarkProcessed();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
