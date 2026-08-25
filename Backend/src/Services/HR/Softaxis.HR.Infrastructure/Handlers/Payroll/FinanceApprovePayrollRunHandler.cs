using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class FinanceApprovePayrollRunHandler(HrDbContext db)
    : ICommandHandler<FinanceApprovePayrollRunCommand>
{
    public async Task<Result> Handle(FinanceApprovePayrollRunCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.Id));

        // Only a run HR has finished with. Approving a draft would sign off figures still being
        // edited; approving twice would move the approval date without meaning anything.
        if (run.Status != "processed")
            return Result.Failure(Error.Custom("PayrollRun.Conflict",
                run.Status == "finance_approved"
                    ? "This payroll run has already been approved."
                    : "Only processed payroll runs can be approved by Finance."));

        run.MarkFinanceApproved(cmd.ApprovedByName);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class LinkPayrollJournalEntryHandler(HrDbContext db)
    : ICommandHandler<LinkPayrollJournalEntryCommand>
{
    public async Task<Result> Handle(LinkPayrollJournalEntryCommand cmd, CancellationToken ct)
    {
        var run = await db.PayrollRuns.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (run is null)
            return Result.Failure(Error.NotFoundById("PayrollRun", cmd.Id));

        run.LinkJournalEntry(cmd.JournalEntryId, cmd.JournalEntryNumber);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
