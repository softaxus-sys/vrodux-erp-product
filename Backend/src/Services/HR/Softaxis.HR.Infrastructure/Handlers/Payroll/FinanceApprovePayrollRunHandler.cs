using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Handlers.Notifications;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class FinanceApprovePayrollRunHandler(
    HrDbContext db, INotificationDispatcher notifications, INotificationRecipients recipients)
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

        // Back to HR: they are the ones who can now disburse, and nothing else tells them the gate
        // has opened.
        await HrAlerts.NotifyQueueAsync(notifications, recipients,
            permissionKey: "hr.payroll.approve",
            module:        NotificationModules.Hr,
            eventKey:      NotificationEvents.PayrollApproved,
            type:          "success",
            title:         "Payroll approved by Finance",
            message:       $"Payroll for {run.Period} was approved{(string.IsNullOrWhiteSpace(cmd.ApprovedByName) ? "" : $" by {cmd.ApprovedByName}")} and can now be paid.",
            link:          "/hr/payroll",
            relatedToType: "payroll-run",
            relatedToId:   run.Id,
            actorUserId:   null,
            ct:            ct);

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
