using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Commands;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Domain.Entities;
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

        var log = new AttendanceLog(
            cmd.EmployeeId, cmd.EmployeeName, cmd.Date,
            cmd.CheckIn, cmd.CheckOut, cmd.WorkingHours,
            cmd.Status, cmd.Notes);

        db.AttendanceLogs.Add(log);
        await db.SaveChangesAsync(ct);

        return Result.Success(AttendanceMappings.ToDto(log));
    }
}
