using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Commands;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Handlers.WorkSchedules;
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

        // Re-judged only when the arrival time actually changed: an edit to notes or status must
        // not quietly overwrite the verdict recorded on the day.
        int? late = cmd.CheckIn == log.CheckIn
            ? null
            : WorkScheduleRules.LateMinutes(await WorkScheduleLookup.FindAsync(db, ct), cmd.CheckIn);

        log.Update(cmd.CheckIn, cmd.CheckOut, cmd.WorkingHours, cmd.Status, cmd.Notes, late);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
