using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Leaves.Commands;
using Softaxis.HR.Infrastructure.Handlers.Notifications;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Leaves;

internal sealed class RejectLeaveHandler(HrDbContext db, INotificationDispatcher notifications)
    : ICommandHandler<RejectLeaveCommand>
{
    public async Task<Result> Handle(RejectLeaveCommand cmd, CancellationToken ct)
    {
        var leave = await db.Leaves.FindAsync([cmd.Id], ct);
        if (leave is null)
            return Result.Failure(Error.NotFoundById("Leave", cmd.Id));

        if (leave.Status != "pending")
            return Result.Failure(Error.Custom("Leave.Conflict", "Only pending leaves can be rejected."));

        leave.Reject(cmd.ApproverId, cmd.Notes);
        await db.SaveChangesAsync(ct);

        // A rejection carries the reason: "declined" with no explanation just generates a follow-up
        // question to whoever declined it.
        var reason = string.IsNullOrWhiteSpace(cmd.Notes) ? "" : $" Reason: {cmd.Notes}";
        await HrAlerts.NotifyEmployeeAsync(db, notifications, leave.EmployeeId,
            NotificationEvents.LeaveRejected, "warning",
            "Leave request declined",
            $"Your {leave.LeaveType} leave from {leave.StartDate} to {leave.EndDate} was declined.{reason}",
            "/hr/me", "leave", leave.Id, cmd.ApproverId, ct);

        return Result.Success();
    }
}
