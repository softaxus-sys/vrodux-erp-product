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
