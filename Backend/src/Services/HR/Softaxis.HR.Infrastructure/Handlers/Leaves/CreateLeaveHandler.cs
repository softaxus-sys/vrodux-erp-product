using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Handlers.Notifications;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class CreateLeaveHandler(
    HrDbContext db, INotificationDispatcher notifications, INotificationRecipients recipients)
    : ICommandHandler<CreateLeaveCommand, LeaveDto>
{
    public async Task<Result<LeaveDto>> Handle(CreateLeaveCommand cmd, CancellationToken ct)
    {
        var leave = new Leave(
            cmd.EmployeeId, cmd.EmployeeName, cmd.LeaveType,
            cmd.StartDate, cmd.EndDate, cmd.TotalDays, cmd.Reason);

        db.Leaves.Add(leave);
        await db.SaveChangesAsync(ct);

        // Whoever can approve leave is told it is waiting. Without this a request sits in a queue
        // nobody is watching until someone happens to open the screen.
        await HrAlerts.NotifyQueueAsync(notifications, recipients,
            permissionKey: "hr.leaves.approve",
            module:        NotificationModules.Hr,
            eventKey:      NotificationEvents.LeaveRequested,
            type:          "info",
            title:         "Leave request awaiting approval",
            message:       $"{cmd.EmployeeName} requested {cmd.TotalDays} day(s) of {cmd.LeaveType} leave from {cmd.StartDate} to {cmd.EndDate}.",
            link:          "/hr/leaves",
            relatedToType: "leave",
            relatedToId:   leave.Id,
            actorUserId:   null,
            ct:            ct);

        return Result.Success(LeaveMappings.ToDto(leave));
    }
}
