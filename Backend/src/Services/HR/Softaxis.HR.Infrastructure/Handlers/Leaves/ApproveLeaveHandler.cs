using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Infrastructure.Handlers.Notifications;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class ApproveLeaveHandler(HrDbContext db, INotificationDispatcher notifications)
    : ICommandHandler<ApproveLeaveCommand>
{
    public async Task<Result> Handle(ApproveLeaveCommand cmd, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([cmd.Id], ct);
        if (leave is null)
            return Result.Failure(Error.NotFoundById("Leave", cmd.Id));

        if (leave.Status != "pending")
            return Result.Failure(Error.Custom("Leave.Conflict", "Only pending leaves can be approved."));

        leave.Approve(cmd.ApproverId, cmd.Notes);
        await db.SaveChangesAsync(ct);

        // The person who asked is the one waiting on this answer.
        await HrAlerts.NotifyEmployeeAsync(db, notifications, leave.EmployeeId,
            NotificationEvents.LeaveApproved, "success",
            "Leave approved",
            $"Your {leave.LeaveType} leave from {leave.StartDate} to {leave.EndDate} was approved.",
            "/hr/me", "leave", leave.Id, cmd.ApproverId, ct);

        return Result.Success();
    }
}
