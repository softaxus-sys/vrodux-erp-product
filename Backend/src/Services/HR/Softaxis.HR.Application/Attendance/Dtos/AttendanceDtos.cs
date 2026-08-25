namespace Softaxis.HR.Application.Attendance.Dtos;

public sealed record AttendanceLogDto(
    Guid      Id,
    Guid      EmployeeId,
    string    EmployeeName,
    string    Date,
    string?   CheckIn,
    string?   CheckOut,
    decimal?  WorkingHours,
    string    Status,
    string?   Notes,

    /// <summary>Minutes past the grace period at check-in; 0 on time, null when not judged.</summary>
    int?      LateMinutes,

    DateTime  CreatedAt,
    DateTime? UpdatedAt);

public sealed record AttendanceTodayDto(string Date, int Total, int Present, int Absent, int Late);

public sealed record AttendanceThisMonthDto(int PresentCount, int TotalRecords, double AvgWorkingHours);

public sealed record AttendanceSummaryDto(
    AttendanceTodayDto     Today,
    AttendanceThisMonthDto ThisMonth,
    int PresentToday,
    int LateToday,
    int AbsentToday,
    int TotalEmployees);
