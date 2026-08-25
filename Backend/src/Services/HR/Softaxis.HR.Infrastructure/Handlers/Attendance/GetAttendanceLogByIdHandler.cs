using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Application.Attendance.Queries;
using Softaxis.HR.Infrastructure.Persistence;

namespace Softaxis.HR.Infrastructure.Handlers.Attendance;

internal sealed class GetAttendanceLogByIdHandler(HrDbContext db)
    : IQueryHandler<GetAttendanceLogByIdQuery, AttendanceLogDto>
{
    public async Task<Result<AttendanceLogDto>> Handle(GetAttendanceLogByIdQuery query, CancellationToken ct)
    {
        var log = await db.AttendanceLogs
            .AsNoTracking()
            .Where(x => x.Id == query.Id)
            .Select(x => new AttendanceLogDto(
                x.Id, x.EmployeeId, x.EmployeeName, x.Date,
                x.CheckIn, x.CheckOut, x.WorkingHours,
                x.Status, x.Notes, x.LateMinutes, x.CreatedAt, x.UpdatedAt))
            .FirstOrDefaultAsync(ct);

        if (log is null)
            return Result.Failure<AttendanceLogDto>(Error.NotFoundById("AttendanceLog", query.Id));

        return Result.Success(log);
    }
}
