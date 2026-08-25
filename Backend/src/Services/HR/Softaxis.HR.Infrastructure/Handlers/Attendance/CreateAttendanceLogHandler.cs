using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Commands;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Domain.Entities;
using Softaxis.HR.Infrastructure.Handlers.WorkSchedules;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Attendance;

internal sealed class CreateAttendanceLogHandler(HrDbContext db)
    : ICommandHandler<CreateAttendanceLogCommand, AttendanceLogDto>
{
    public async Task<Result<AttendanceLogDto>> Handle(CreateAttendanceLogCommand cmd, CancellationToken ct)
    {
        var exists = await db.AttendanceLogs
            .AnyAsync(x => x.EmployeeId == cmd.EmployeeId && x.Date == cmd.Date, ct);
        if (exists)
            return Result.Failure<AttendanceLogDto>(Error.Custom(
                "AttendanceLog.Duplicate", $"Attendance record already exists for this employee on {cmd.Date}."));

        // Judged once, at the moment the arrival is recorded, against the office hours in force
        // now — a later change to those hours must not rewrite history.
        var schedule = await WorkScheduleLookup.FindAsync(db, ct);

        var log = new AttendanceLog(
            cmd.EmployeeId, cmd.EmployeeName, cmd.Date,
            cmd.CheckIn, cmd.CheckOut, cmd.WorkingHours,
            cmd.Status, cmd.Notes,
            WorkScheduleRules.LateMinutes(schedule, cmd.CheckIn));

        db.AttendanceLogs.Add(log);
        await db.SaveChangesAsync(ct);

        return Result.Success(AttendanceMappings.ToDto(log));
    }
}
