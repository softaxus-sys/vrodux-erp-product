using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Payroll.Commands;
using Softaxis.HR.Infrastructure.Handlers.Notifications;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Payroll;

internal sealed class ProcessPayrollRunHandler(
    HrDbContext db, INotificationDispatcher notifications, INotificationRecipients recipients)
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

        // Finance is the next gate, and HR cannot pay until they act — so they are told rather than
        // left to discover it.
        await HrAlerts.NotifyQueueAsync(notifications, recipients,
            permissionKey: "finance.payroll.approve",
            module:        NotificationModules.Finance,
            eventKey:      NotificationEvents.PayrollAwaitingFinance,
            type:          "info",
            title:         "Payroll awaiting Finance approval",
            message:       $"Payroll for {run.Period} is ready for review.",
            link:          "/hr/payroll",
            relatedToType: "payroll-run",
            relatedToId:   run.Id,
            actorUserId:   null,
            ct:            ct);

        return Result.Success();
    }
}
