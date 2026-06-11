using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Commands;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Attendance;

internal sealed class UpdateAttendanceLogHandler(HrDbContext db)
    : ICommandHandler<UpdateAttendanceLogCommand>
{
    public async Task<Result> Handle(UpdateAttendanceLogCommand cmd, CancellationToken ct)
    {
        var log = await db.AttendanceLogs.FindAsync([cmd.Id], ct);
        if (log is null)
            return Result.Failure(Error.NotFoundById("AttendanceLog", cmd.Id));

        log.Update(cmd.CheckIn, cmd.CheckOut, cmd.WorkingHours, cmd.Status, cmd.Notes);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
