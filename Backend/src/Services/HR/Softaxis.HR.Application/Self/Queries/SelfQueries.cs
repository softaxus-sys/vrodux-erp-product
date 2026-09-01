using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Attendance.Dtos;
using Softaxis.HR.Application.Common.Dtos;
using Softaxis.HR.Application.LeavePolicies.Dtos;
using Softaxis.HR.Application.Leaves.Dtos;
using Softaxis.HR.Application.Payroll.Dtos;
using Softaxis.HR.Application.Self.Dtos;

namespace Softaxis.HR.Application.Self.Queries;

// None of these carry an employee id. The employee is resolved from the JWT, which is precisely
// what makes them structurally incapable of returning someone else's data.

public sealed record GetMyProfileQuery              : IQuery<MyProfileDto>;
public sealed record GetMyLeavesQuery(int Page = 1, int PageSize = 25) : IQuery<PagedResult<LeaveDto>>;
public sealed record GetMyLeaveBalancesQuery(int? Year = null) : IQuery<IReadOnlyList<LeaveBalanceDto>>;
// Was capped at 200 rows with no total and no way to reach the 201st — a year of daily records
// exceeds that, so older attendance was simply unreachable. Pages properly now.
public sealed record GetMyAttendanceQuery(
    string? FromDate = null, string? ToDate = null,
    int Page = 1, int PageSize = 31)
    : IQuery<PagedResult<AttendanceLogDto>>;
public sealed record GetMyAttendanceTodayQuery      : IQuery<MyAttendanceTodayDto>;
public sealed record GetMyPayslipsQuery(int Page = 1, int PageSize = 24) : IQuery<PagedResult<EmployeePayslipDto>>;
