using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Attendance;

internal sealed class DeleteAttendanceLogHandler(HrDbContext db)
    : ICommandHandler<DeleteAttendanceLogCommand>
{
    public async Task<Result> Handle(DeleteAttendanceLogCommand cmd, CancellationToken ct)
    {
        var log = await db.AttendanceLogs.FindAsync([cmd.Id], ct);
        if (log is null)
            return Result.Failure(Error.NotFoundById("AttendanceLog", cmd.Id));

        db.AttendanceLogs.Remove(log);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
