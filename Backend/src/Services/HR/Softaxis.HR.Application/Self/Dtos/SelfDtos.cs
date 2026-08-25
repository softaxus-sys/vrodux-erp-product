namespace Softaxis.HR.Application.Self.Dtos;

/// <summary>
/// What an employee may see about themselves. Deliberately narrower than <c>EmployeeDto</c> —
/// self-service shows employment facts, not the administrative record.
/// </summary>
public sealed record MyProfileDto(
    Guid     EmployeeId,
    string   EmployeeNumber,
    string   FullName,
    string   Email,
    string?  Phone,
    string?  JobTitle,
    string?  DepartmentName,
    string   EmploymentType,
    string   JoiningDate,
    string   Status,
    decimal  BasicSalary,
    string?  Nationality,
    string?  EmiratesId,
    string?  PassportNumber,
    string?  VisaExpiry,
    string?  BankAccount,
    string?  Iban,
    string?  AvatarData);
 
/// <summary>
/// Today's attendance for the signed-in employee, together with the office hours it is judged
/// against — so the screen can say "on time" or "late by 12 minutes" without a second call, and
/// without the employee needing permission to read the schedule itself.
/// </summary>
/// <param name="LateMinutes">0 when on time, null when there is nothing to judge yet.</param>
public sealed record MyAttendanceTodayDto(
    string   Date,
    string?  CheckIn,
    string?  CheckOut,
    decimal? WorkingHours,
    string?  Status,
    int?     LateMinutes   = null,
    string?  ScheduleStart = null,
    string?  ScheduleEnd   = null,
    int      GraceMinutes  = 0,
    bool     IsWorkingDay  = true);
