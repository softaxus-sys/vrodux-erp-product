using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Attendance;

internal static class AttendanceMappings
{
    public static AttendanceLogDto ToDto(AttendanceLog x) => new(
        x.Id, x.EmployeeId, x.EmployeeName, x.Date,
        x.CheckIn, x.CheckOut, x.WorkingHours,
        x.Status, x.Notes, x.CreatedAt, x.UpdatedAt);
}
